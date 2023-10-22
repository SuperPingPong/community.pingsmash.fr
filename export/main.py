import os.path
import requests
import urllib3
import urllib.parse

import json
from typing import Dict

from tqdm import tqdm
from utils import format_response

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

session = requests.session()
session.verify = False

CHAMPIONNAT = "FED_Championnat de France par Equipes Masculin"
MAP_CLUB_NAME_CLUB_ID = {}
CHECK = []


def extract_organisme_ids(result: Dict):
    return [
        item.get('id') for item in result['liste']['organisme']
    ]


def search_epreuve_from_organisme(result: Dict):
    for epreuve in result['liste']['epreuve']:
        if epreuve.get('libelle') == CHAMPIONNAT:
            return epreuve.get('idepreuve')


def extract_division_ids(result: Dict):
    if result['liste'] is None:
        return []
    division = result['liste']['division']
    if isinstance(division, list):
        return [
            item.get('iddivision') for item in division
        ]
    elif isinstance(division, dict):
        item = division
        return [
            item.get('iddivision')
        ]
    else:
        raise Exception('Unknown type for division')


def extract_poule_params(result: Dict):
    if result['liste'] is None:
        return []
    poule = result['liste']['poule']
    if isinstance(poule, list):
        output = [
            urllib.parse.parse_qs(item.get('lien')) for item in result['liste']['poule']
        ]
    elif isinstance(poule, dict):
        item = result['liste']['poule']
        output = [
            urllib.parse.parse_qs(item.get('lien'))
        ]
    else:
        raise Exception('Unknown type for poule')
    parsed_output = [
        {key: value[0] for key, value in poule_params.items()}
        for poule_params in output
    ]
    return parsed_output


def update_map_club_name_club_id(result: Dict):
    if result['liste'] is None:
        return
    for tour in result['liste']['tour']:
        output_link = urllib.parse.parse_qs(tour.get('lien'))
        parsed_output = {key: value[0] for key, value in output_link.items()}
        club_ids = []
        if parsed_output.get('clubnum_1'):
            club_ids.append(parsed_output['clubnum_1'])
        if parsed_output.get('clubnum_2'):
            club_ids.append(parsed_output['clubnum_2'])
        for club_id in club_ids:
            url = f"https://fftt.dafunker.com/v1//proxy/xml_club_detail.php?club={club_id}"
            response = session.get(url, params={})
            result_club = format_response(response)
            club_name = result_club['liste']['club']['nom'].strip()

            MAP_CLUB_NAME_CLUB_ID[club_name] = club_id.strip()
            #  print((club_id, club_name))
            #  PROGRESS_BAR.set_description(f"Processing club_id={club_id}, club_name='{club_name}'")
    return


def update_map_by_organisme_id(organisme_id):
    url = "https://fftt.dafunker.com/v1//proxy/xml_epreuve.php"
    response = session.get(url, params={
        "organisme": organisme_id,
        "type": "E",
        "no_organisme_proxy": 1
    })
    result = format_response(response)
    epreuve_id = search_epreuve_from_organisme(result)

    url = "https://fftt.dafunker.com/v1//proxy/xml_division.php"
    response = session.get(url, params={
        "organisme": organisme_id,
        "epreuve": epreuve_id,
        "type": "E",
        "no_organisme_proxy": 1
    })
    result = format_response(response)
    #  print(json.dumps(result, indent=4))
    national_division_ids = extract_division_ids(result)

    url = "https://fftt.dafunker.com/v1//proxy/xml_result_equ.php"
    for division_id in national_division_ids:
        #  division_id = '125467'
        response = session.get(url, params={
            "force": 1,
            "D1": division_id,
            "action": "poule",
        })
        result_poules = format_response(response)
        poule_params = extract_poule_params(result_poules)
        for poule_param in poule_params:
            response = session.get(url, params={
                "force": 1,
                **poule_param
            })
            result_poule_details = format_response(response)
            #  print(json.dumps(result_poule_details, indent=4))
            update_map_club_name_club_id(result_poule_details)


organisme_types = [
    'L',
    'D',
]
"""
type:
- D: Départemental
- L: Régional
- Z: Zones
--> National: organisme_id=1
"""

organisme_ids = [
    '1',  # National
    '4',  # Pre-Nat
    '6',  # PN autre ?
]

for organisme_type in organisme_types:
    url = "https://fftt.dafunker.com/v1//proxy/xml_organisme.php"
    response = session.get(url, params={"type": organisme_type})
    result = format_response(response)
    organisme_ids += extract_organisme_ids(result)

PROGRESS_BAR = tqdm(organisme_ids)
for organisme_id in PROGRESS_BAR:
    update_map_by_organisme_id(organisme_id)

output_path = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    '../backend/map.json'
)
with open(output_path, 'wb') as f:
    f.write(json.dumps(MAP_CLUB_NAME_CLUB_ID).encode())
