from flask import Flask, request, abort
from flask_cors import CORS

from os import environ
import re
import requests
import requests.models
import json
import xmltodict
import urllib3
import xml.etree.ElementTree as ET

from typing import Dict, Tuple

def extract_int(s):
    return int(re.findall(r"(\d+)pts$", s)[0])

def convert_to_float(string_value):
    float_value = float(string_value)
    return int(float_value) if float_value.is_integer() else float_value

def format_response(response: requests.models.Response) -> Tuple[str, int, Dict[str, str]]:
    try:
        xml = ET.fromstring(response.content.replace(b'ISO-8859-1', b'UTF-8'))
        result = xmltodict.parse(ET.tostring(xml, encoding='utf-8'))
    except ET.ParseError:
        result = json.loads(response.content)
    return json.dumps(result), response.status_code, {'Content-Type': 'application/json; charset=utf-8'}

# copy from https://github.com/SuperPingPong/score.pingsmash.fr/blob/main/backend/utils.py
def replace_empty_epreuve(d):
    """
    Replace empty 'epreuve' fields with the same value from other subdicts with the same 'date'
    """
    # Create a dict where the keys are the 'date' values and the values are a list of subdictionaries with that 'date'
    date_to_subdicts = {}
    for subdict in d['list']:
        for journee in subdict['journees']:
            date = journee['date']
            if date not in date_to_subdicts:
                date_to_subdicts[date] = []
            date_to_subdicts[date].append(journee)

    # For each 'date' with multiple subdictionaries, iterate through them and find the first non-empty 'epreuve' field
    for subdicts in date_to_subdicts.values():
        epreuve = ''
        for subdict in subdicts:
            if subdict['epreuve'] != '':
                epreuve = subdict['epreuve']
                break

        # Replace any empty 'epreuve' fields with the value of the first non-empty 'epreuve' field
        for subdict in subdicts:
            if subdict['epreuve'] == '':
                subdict['epreuve'] = epreuve

    # Create a dictionary to store the matches by epreuve and date
    matches_by_epreuve_and_date = {}

    for block in d['list']:
        for journee in block['journees']:
            for match in journee['matchs']:
                epreuve = journee['epreuve']
                date = journee['date']
                if date:
                    if (epreuve, date) not in matches_by_epreuve_and_date:
                        matches_by_epreuve_and_date[(epreuve, date)] = {
                            'processed': block['processed'],
                            'epreuve': epreuve,
                            'date': date,
                            'matchs': [match]
                        }
                    else:
                        matches_by_epreuve_and_date[(epreuve, date)]['matchs'].append(match)

    # Create a list of dictionaries from the dictionary of matches by epreuve and date
    grouped_matches = {'list': [
        {'processed': 0, 'journees': []},  # processed: 0
        {'processed': 1, 'journees': []},  # processed: 1
    ]}
    for match_dict in matches_by_epreuve_and_date.values():
        grouped_matches['list'][match_dict['processed']]['journees'].append({
            'epreuve': match_dict.get('epreuve'),
            'date': match_dict.get('date'),
            'matchs': match_dict.get('matchs')
        })
    return grouped_matches

def get_player_info(s: requests.Session, CLUB_NAME: str, name: str):
    url = "https://fftt.dafunker.com/v1//proxy/xml_liste_joueur_o.php"
    response = s.get(url, params={"nom": name, "prenom": ""})
    root = ET.fromstring(response.content.replace(b'ISO-8859-1', b'UTF-8'))
    players = root.findall('joueur')
    result = None
    for player in players:
        nclub = player.find('nclub').text
        if nclub != CLUB_NAME:
            continue
        surname = player.find('nom').text.strip()
        name = player.find('prenom').text.strip()
        score = player.find('points').text
        license_number = player.find('licence').text
        player_result = {
            'surname': surname,
            'name': name,
            'nclub': nclub,
            'score': score,
            'license': license_number
        }
        return player_result
    if result is None:
        raise Exception(f'Cannot find player from name="{name}" and club_name="{CLUB_NAME}"')

def get_player_matchs(s: requests.Session, license_number: str):
    url = f"https://fftt.dafunker.com/v1/parties/{license_number}"
    response = s.get(url)
    content = response.json()
    matches_by_epreuve_and_date = replace_empty_epreuve(content)
    return matches_by_epreuve_and_date
