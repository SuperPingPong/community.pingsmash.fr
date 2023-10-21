from flask import Flask, request, abort
from flask_cors import CORS

from os import environ
import requests
import requests.models
import json
import xmltodict
import urllib3
import xml.etree.ElementTree as ET

from typing import Dict, Tuple


def format_response(response: requests.models.Response) -> Tuple[str, int, Dict[str, str]]:
    try:
        xml = ET.fromstring(response.content.replace(b'ISO-8859-1', b'UTF-8'))
        result = xmltodict.parse(ET.tostring(xml, encoding='utf-8'))
    except ET.ParseError:
        result = json.loads(response.content)
    return json.dumps(result), response.status_code, {'Content-Type': 'application/json; charset=utf-8'}
