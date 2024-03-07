from flask import Flask, request, abort
from flask_cors import CORS
import sentry_sdk
from sentry_sdk.integrations.flask import FlaskIntegration

from os import environ
import json
import re
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
import urllib3
from urllib.parse import unquote

from utils import format_response
import utils

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

app = Flask(__name__)
cors = CORS(app)
app.config['CORS_HEADERS'] = 'Content-Type'
debug = environ.get('DEBUG', False)

SENTRY_DSN = environ.get('SENTRY_DSN')
if SENTRY_DSN is None:
    raise Exception('Please configure environment variable SENTRY_DSN')
sentry_sdk.init(
    dsn=SENTRY_DSN,
    integrations=[FlaskIntegration()]
)
sentry_sdk.set_tag("app", "fftt-community")

# Error handler for other exceptions
@app.errorhandler(Exception)
def handle_exception(error):
    sentry_sdk.capture_exception(error)
    if not hasattr(error, 'code'):
        error_code = 500
    else:
        error_code = error.code
    if not hasattr(error, 'description'):
        error_description = ''
    else:
        error_description = error.description
    return error_description, error_code

retry_strategy = Retry(
    total=3, #  Maximum number of retries
    backoff_factor=0.3, #  Exponential backoff factor
    status_forcelist=[500, 502, 503, 504]  # HTTP status codes to retry on
)

session = requests.session()
session.verify = False
adapter = HTTPAdapter(max_retries=retry_strategy)
session.mount('http://', adapter)
session.mount('https://', adapter)

with open('map.json', 'rb') as f:
    MAP_CLUB_NAME_CLUB_ID = json.loads(f.read())

@app.route('/api/club/search', methods=['GET', 'OPTIONS'])
def search_club():
    search_club_name = request.args.get('club_name', '').lower()
    result = [
        {
            'club_name': club_name,
            'club_id': club_id
        }
        for club_name, club_id in MAP_CLUB_NAME_CLUB_ID.items()
        if search_club_name in club_name.lower()
    ]
    return json.dumps(result[:10]), 200, {'Content-Type': 'application/json; charset=utf-8'}


@app.route('/api/club/select', methods=['GET', 'OPTIONS'])
def select_club():
    select_club_name = request.args.get('club_name', '')
    if select_club_name not in MAP_CLUB_NAME_CLUB_ID:
        abort(400)
    result = {
        'club_name': select_club_name,
        'club_id': MAP_CLUB_NAME_CLUB_ID[select_club_name]
    }
    return json.dumps(result), 200, {'Content-Type': 'application/json; charset=utf-8'}

def get_organismes(organisme_type: str):
    url = "https://fftt.dafunker.com/v1//proxy/xml_organisme.php"
    response = session.get(url, params={"type": organisme_type})
    return response

@app.route("/api/organismes", methods=['GET', 'OPTIONS'])
def list_organismes():
    organisme_type = request.args.get("type", "")
    """
    type:
    - D: Départemental
    - L: Régional
    - Z: Zones
    --> National: organisme_id=1
    """
    if not organisme_type:
        abort(400)
    response = get_organismes(organisme_type)
    """
    {
      "liste": {
        "organisme": [
          {
            "libelle": "AIN",
            "id": "118",
            "code": "D01",
            "idPere": "9"
          },
          ...
    """
    return format_response(response)


@app.route("/api/epreuves", methods=['GET', 'OPTIONS'])
def list_epreuves():
    organisme_id = request.args.get("organisme", "")
    if not organisme_id:
        abort(400)

    url = "https://fftt.dafunker.com/v1//proxy/xml_epreuve.php"
    response = session.get(url, params={
        "organisme": organisme_id,
        "type": "E",
        "no_organisme_proxy": 1
    })
    """
    {
      "liste": {
        "epreuve": [
          ...
          {
            "idepreuve": "11344",
            "idorga": "1",
            "libelle": "FED_Championnat de France par Equipes Masculin",
            "typepreuve": "H"
          },
          ...
    """
    return format_response(response)


@app.route("/api/divisions", methods=['GET', 'OPTIONS'])
def list_divisions():
    organisme_id = request.args.get("organisme", "")
    epreuve_id = request.args.get("epreuve", "")
    if not organisme_id or not epreuve_id:
        abort(400)

    url = "https://fftt.dafunker.com/v1//proxy/xml_division.php"
    response = session.get(url, params={
        "organisme": organisme_id,
        "epreuve": epreuve_id,
        "type": "E",
        "no_organisme_proxy": 1
    })
    """
    {
      "liste": {
        "division": [
          {
            "iddivision": "125411",
            "libelle": "D76_Départementale 1 Phase 1 (Phase 1)"
          },
          ...
    """
    return format_response(response)

def get_teams(club_id: str):
    url = f"https://fftt.dafunker.com/v1/club/{club_id}/equipes"
    response = session.get(url, params={})
    result = json.loads(response.content)
    sorted_result = sorted(result, key=lambda x: int(re.findall(r'(\d+)', x["libequipe"])[0]))
    return response, sorted_result

@app.route("/api/teams", methods=['GET', 'OPTIONS'])
def list_teams():
    club_id = request.args.get("club_id", "")
    if not club_id:
        abort(400)
    response, sorted_result = get_teams(club_id)
    """
    [
      ...
      {
        "idequipe": "9188",
        "type": "M",
        "libequipe": "LOGNES EP 11 - Phase 1",
        "libdivision": "DEP 2 M Ph1 Poule 5",
        "liendivision": "cx_poule=655330&D1=125776&organisme_pere=81",
        "idepr": "11344",
        "libepr": "FED_Championnat de France par Equipes Masculin"
      }
      ...
    """
    return json.dumps(sorted_result), response.status_code, {'Content-Type': 'application/json; charset=utf-8'}


def get_team_results_query(division_id: str, poule_id: str):
    url = "https://fftt.dafunker.com/v1//proxy/xml_result_equ.php"
    response = session.get(url, params={
        "force": 1,
        "D1": division_id,
        "cx_poule": poule_id,
    })
    return response

@app.route("/api/team/results", methods=['GET', 'OPTIONS'])
def get_team_results():
    division_id = request.args.get("D1", "")
    poule_id = request.args.get("cx_poule", "")
    if not division_id or not poule_id:
        abort(400)

    response = get_team_results_query(division_id, poule_id)
    """
    {
      "liste": {
        "tour": [
          {
            "libelle": "Poule 5 - tour n°1 du 29/09/2023",
            "equa": "LAGNY SMTT 4",
            "equb": "LOGNES EP 11",
            "scorea": "24",
            "scoreb": "18",
            "lien": "renc_id=2472719&is_retour=0&phase=1&res_1=24&res_2=18&equip_1=LAGNY+SMTT+4&equip_2=LOGNES+EP+11&equip_id1=9133&equip_id2=9188&clubnum_1=08770166&clubnum_2=08771184",
            "dateprevue": "29/09/2023",
            "datereelle": "29/09/2023"
          },
          ...

    """
    return format_response(response)


@app.route("/api/team/rank", methods=['GET', 'OPTIONS'])
def get_team_rank():
    division_id = request.args.get("D1", "")
    poule_id = request.args.get("cx_poule", "")
    if not division_id or not poule_id:
        abort(400)

    url = "https://fftt.dafunker.com/v1//proxy/xml_result_equ.php"
    response = session.get(url, params={
        "force": 1,
        "action": "classement",
        "D1": division_id,
        "cx_poule": poule_id,
    })
    """
    {
      "liste": {
        "tour": [
          {
            "libelle": "Poule 5 - tour n°1 du 29/09/2023",
            "equa": "LAGNY SMTT 4",
            "equb": "LOGNES EP 11",
            "scorea": "24",
            "scoreb": "18",
            "lien": "renc_id=2472719&is_retour=0&phase=1&res_1=24&res_2=18&equip_1=LAGNY+SMTT+4&equip_2=LOGNES+EP+11&equip_id1=9133&equip_id2=9188&clubnum_1=08770166&clubnum_2=08771184",
            "dateprevue": "29/09/2023",
            "datereelle": "29/09/2023"
          },
          ...

    """
    return format_response(response)


def get_team_matchs_query(params):
    url = "https://fftt.dafunker.com/v1//proxy/xml_chp_renc.php"
    response = session.get(url, params=params)
    return response

@app.route("/api/result_chp_renc", methods=['GET', 'OPTIONS'])
def get_team_matchs():
    mandatory_params = [
        'renc_id', 'is_retour', 'phase',
        'res_1', 'res_2', 'equip_1', 'equip_2',
        'equip_id1', 'equip_id2', 'clubnum_1', 'clubnum_2',
    ]
    params = {}
    for param in mandatory_params:
        param_value = request.args.get(param, "")
        if not param_value:
            #  abort(400)
            return json.dumps({}), 200, {'Content-Type': 'application/json; charset=utf-8'}
        params[param] = param_value

    response = get_team_matchs_query(params)
    """
    {
      "liste": {
        "resultat": {
          "equa": "LAGNY SMTT 4",
          "equb": "LOGNES EP 11",
          "resa": "24",
          "resb": "18"
        },
        "joueur": [
          {
            "xja": "PERCQUE Dominique",
            "xca": "M 924pts",
            "xjb": "HO Felicien",
            "xcb": "M 746pts"
          },
          {
            "xja": "PERNET Xavier",
            "xca": "M 892pts",
            "xjb": "LIM Hugo",
            "xcb": "M 601pts"
          },
          {
            "xja": "MARCHETTI Philippe",
            "xca": "M 663pts",
            "xjb": "ZEBAIR Kamel",
            "xcb": "M 693pts"
          },
          {
            "xja": "TROUILLET Daniel",
            "xca": "M 816pts",
            "xjb": "DUBOC Aurélien",
            "xcb": "M 700pts"
          }
        ],
        "partie": [
          {
            "ja": "PERCQUE Dominique",
            "scorea": "1",
            "jb": "HO Felicien",
            "scoreb": "2",
            "detail": "-06 -07 10 -10"
          },
          ...
        ]
      }
    }
    """
    return format_response(response)

@app.route("/api/result_perfs", methods=['GET', 'OPTIONS'])
def get_teams_perfs():
    mandatory_params = [
        'club_id', 'club_name', 'rencontre_choice'
    ]
    params = {}
    for param in mandatory_params:
        param_value = request.args.get(param, "")
        if not param_value:
            abort(400)
            #  return json.dumps({}), 200, {'Content-Type': 'application/json; charset=utf-8'}
        params[param] = param_value

    CLUB_ID = params['club_id']
    CLUB_NAME = params['club_name']
    RENCONTRE_CHOICE = params['rencontre_choice']

    group_regex = re.compile(r'(.+) J\d+ \((.+)\)')
    match_text_value = group_regex.match(RENCONTRE_CHOICE)
    TARGET_GROUP = match_text_value.group(1)
    DATE_PREVUE = match_text_value.group(2)

    ORGANISME_NATIONAL_IDS = ['1', '4']
    ORGANISME_REGIONAL, _, _ = format_response(get_organismes('L'))
    ORGANISME_REGIONAL_IDS = [
        item.get('id') for item in json.loads(ORGANISME_REGIONAL)['liste']['organisme']
    ]
    ORGANISME_DEPARTEMENTAL, _, _ = format_response(get_organismes('D'))
    ORGANISME_DEPARTEMENTAL_IDS = [
        item.get('id') for item in json.loads(ORGANISME_DEPARTEMENTAL)['liste']['organisme']
    ]

    _, teams = get_teams(CLUB_ID)
    PERFS = []
    TOTAL_MATCHS_TEAM = 0
    TOTAL_MATCHS_TEAM_PROCESSED = 0

    for team in teams:
        libdivision = team.get('libdivision')
        division = team.get('liendivision')
        pattern = r'organisme_pere=(\d+)'
        match = re.search(pattern, division)
        organisme_id = str(match.group(1))
        groups = ['National', 'Régional', 'Départemental']
        if organisme_id in ORGANISME_NATIONAL_IDS:
            group = 'National'
        elif organisme_id in ORGANISME_REGIONAL_IDS:
            group = 'Régional'
        elif organisme_id in ORGANISME_DEPARTEMENTAL_IDS:
            group = 'Départemental'
        else:
            raise Exception(f'Unknown group for organisme_id={organisme_id}')

        # Filter on group
        if TARGET_GROUP != group:
            continue

        result_params_dict = {
          item.split('=')[0]:item.split('=')[1] for item in division.split('&')
        }
        rencontres, _, _ = format_response(get_team_results_query(result_params_dict['D1'], result_params_dict['cx_poule']))
        for rencontre in json.loads(rencontres)['liste']['tour']:
            if rencontre.get('dateprevue') != DATE_PREVUE:
                continue
            match_params=rencontre.get('lien')
            match_params_dict = {
              item.split('=')[0]:unquote(item.split('=')[1].replace('+', ' '))
              for item in match_params.split('&')
            }
            matchs, _, _ = format_response(get_team_matchs_query(match_params_dict))
            matchs = json.loads(matchs)

            # Filter on matchs from club_id
            is_equ1 = match_params_dict['clubnum_1'] == str(CLUB_ID)
            is_equ2 = match_params_dict['clubnum_2'] == str(CLUB_ID)
            if not is_equ1 and not is_equ2:
                continue
            players = matchs['liste']['joueur']
            # Sometimes clubnum_1 is not mapped to equa
            equa = matchs['liste']['resultat']['equa']
            #  equb = matchs['liste']['resultat']['equb']
            if players is None:
                continue

            if match_params_dict['equip_1'] == equa:
                if is_equ1:
                  player_names = [p['xja'] for p in players]
                else:
                  player_names = [p['xjb'] for p in players]
            else:
                if is_equ1:
                  player_names = [p['xjb'] for p in players]
                else:
                  player_names = [p['xja'] for p in players]

            # Manage if there is no opposite team
            if player_names == [None] * len(player_names):
                continue

            if matchs.get('liste', {}).get('partie', []) is not None:
              TOTAL_MATCHS_TEAM+=len([
                  m for m in matchs.get('liste', {}).get('partie', [])
                  if (m['ja'] is not None and m['jb'] is not None) and
                  (' et ' not in m['ja'] and ' et ' not in m['jb'])
              ])

            for name in player_names:
                player_info = utils.get_player_info(session, CLUB_NAME, name)
                player_license = player_info['license']
                player_matchs = utils.get_player_matchs(session, player_license)
                # Filter matchs for a specific date
                filtered_matchs = [
                    journee['matchs']
                    for entry in player_matchs['list']
                    for journee in entry.get('journees', {})
                    if journee.get('date') == DATE_PREVUE
                ]
                if len(filtered_matchs) == 0:
                    filtered_matchs = []
                else:
                  filtered_matchs = filtered_matchs[0]
                for match in filtered_matchs:
                    player = {}
                    for p in players:
                        if p['xja'] is None or p['xjb'] is None:
                          continue
                        if p['xja'].lower() == name.lower():
                            player['team_player_name'] = p['xja']
                            player['team_player_score'] = p['xca']
                        if p['xjb'].lower() == name.lower():
                            player['team_player_name'] = p['xjb']
                            player['team_player_score'] = p['xcb']
                        if p['xja'].lower().encode() == match['nom'].encode('latin-1').lower():
                            player['opposite_team_player_name'] = p['xja']
                            player['opposite_team_player_score'] = p['xca']
                        if p['xjb'].lower().encode() == match['nom'].encode('latin-1').lower():
                            player['opposite_team_player_name'] = p['xjb']
                            player['opposite_team_player_score'] = p['xcb']
                    # Manage if there is some matchs if absent player
                    if player.get('opposite_team_player_name') is None:
                        continue
                    if player.get('team_player_name') is None:
                        continue
                    TOTAL_MATCHS_TEAM_PROCESSED += 1
                    # Perf must be a victory
                    if match.get('ex', 0) <= 0:
                        continue
                    PERFS.append(dict(libdivision=libdivision, name=name, player=player, match=match))

    PERFS = sorted(
        PERFS,
        key=lambda perf: (
            perf['match']['ex'],
            abs(utils.extract_int(perf['player']['opposite_team_player_score']) - utils.extract_int(perf['player']['team_player_score']))
        ),
        reverse=True
    )
    RESULT = PERFS[:6]
    RESULT_DISPLAY={
        'total_matchs_team': TOTAL_MATCHS_TEAM,
        'total_matchs_team_processed': TOTAL_MATCHS_TEAM_PROCESSED,
        'result_display': []
    }
    MEDALS = ['🥇', '🥈', '🥉']
    DEFAULT_MEDAL = '🏓'
    for key, result in enumerate(RESULT):
      if key < len(MEDALS):
        medal = MEDALS[key]
      else:
        medal = DEFAULT_MEDAL
      RESULT_DISPLAY['result_display'].append({
          'result': f'{medal} (+{utils.convert_to_float(result["match"]["ex"])}) {result["player"]["team_player_name"]} ({utils.extract_int(result["player"]["team_player_score"])}pts)' + \
            ' VS ' \
            f'{result["player"]["opposite_team_player_name"]} ({utils.extract_int(result["player"]["opposite_team_player_score"])}pts)',
          'libdivision': result['libdivision']
      })
    return json.dumps(RESULT_DISPLAY), 200, {'Content-Type': 'application/json; charset=utf-8'}


if __name__ == "__main__":
    app.run(host="0.0.0.0", debug=debug)
