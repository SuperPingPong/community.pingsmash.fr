from flask import Flask, request, abort
from flask_cors import CORS

from os import environ
import json
import re
import requests
import urllib3

from utils import format_response

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

app = Flask(__name__)
cors = CORS(app)
app.config['CORS_HEADERS'] = 'Content-Type'
debug = environ.get('DEBUG', False)

session = requests.session()
session.verify = False

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
    url = "https://fftt.dafunker.com/v1//proxy/xml_organisme.php"
    response = session.get(url, params={"type": organisme_type})
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


@app.route("/api/teams", methods=['GET', 'OPTIONS'])
def list_teams():
    club_id = request.args.get("club_id", "")
    if not club_id:
        abort(400)
    url = f"https://fftt.dafunker.com/v1/club/{club_id}/equipes"
    response = session.get(url, params={})
    result = json.loads(response.content)
    sorted_result = sorted(result, key=lambda x: int(re.findall(r'(\d+)', x["libequipe"])[0]))
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


@app.route("/api/team/results", methods=['GET', 'OPTIONS'])
def get_team_results():
    division_id = request.args.get("D1", "")
    poule_id = request.args.get("cx_poule", "")
    if not division_id or not poule_id:
        abort(400)

    url = "https://fftt.dafunker.com/v1//proxy/xml_result_equ.php"
    response = session.get(url, params={
        "force": 1,
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
    url = "https://fftt.dafunker.com/v1//proxy/xml_chp_renc.php"
    response = session.get(url, params=params)
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


if __name__ == "__main__":
    app.run(host="0.0.0.0", debug=debug)
