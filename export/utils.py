import requests.models
import json
import xmltodict
import xml.etree.ElementTree as ET

from typing import Dict


def format_response(response: requests.models.Response) -> Dict:
    try:
        xml = ET.fromstring(response.content.replace(b'ISO-8859-1', b'UTF-8'))
        result = xmltodict.parse(ET.tostring(xml, encoding='utf-8'))
    except ET.ParseError:
        result = json.loads(response.content)
    return json.loads(json.dumps(result))
