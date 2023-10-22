# 🏓 community.pingsmash.fr 🏓

## Development

```bash
docker-compose -f docker-compose-dev.yml up
```

## API Usage

### Search for clubs

```
http://127.0.0.1:5000/api/club/search?club_name=amneville
```
```json
[
  {
    "club_name": "AMNEVILLE Tennis de Table",
    "club_id": "06570070"
  }
]
```

### Find teams from club

```
http://127.0.0.1:5000/api/teams?club_id=06570070
```
```json
[
  ...
  {
    "idequipe": "5439",
    "type": "M",
    "libequipe": "T.T. Amneville 2 - Phase 1",
    "libdivision": "GE Elite P1 Poule 2",
    "liendivision": "cx_poule=654463&D1=125542&organisme_pere=14",
    "idepr": "11344",
    "libepr": "FED_Championnat de France par Equipes Masculin"
  },
  ...
]
```

### Search for matchs by teams

```
http://127.0.0.1:5000/api/team/results?cx_poule=654463&D1=125542
```
```json
{
  "liste": {
    "tour": [
      {
        "libelle": "Poule 2 - tour n°1 du 23/09/2023",
        "equa": "MANOM JS 2",
        "equb": "T.T. Amneville 2",
        "scorea": "3",
        "scoreb": "11",
        "lien": "renc_id=2339202&is_retour=0&phase=1&res_1=3&res_2=11&equip_1=MANOM+JS+2&equip_2=T.T.+Amneville+2&equip_id1=2355&equip_id2=5439&clubnum_1=06570014&clubnum_2=06570070",
        "dateprevue": "23/09/2023",
        "datereelle": "23/09/2023"
      },
      ...
   }     
]
```

### Search for matchs details by teams

```
http://127.0.0.1:5000/api/result_chp_renc?renc_id=2339202&is_retour=0&phase=1&res_1=3&res_2=11&equip_1=MANOM+JS+2&equip_2=T.T.+Amneville+2&equip_id1=2355&equip_id2=5439&clubnum_1=06570014&clubnum_2=06570070
```
```json
{
  "liste": {
    "resultat": {
      "equa": "T.T. Amneville 2",
      "equb": "MANOM JS 2",
      "resa": "11",
      "resb": "3"
    },
    "joueur": [
      {
        "xja": "BIGOT Florian",
        "xca": "M 1731pts",
        "xjb": "GORINI Pierre",
        "xcb": "M 1743pts"
      },
      {
        "xja": "DULCY Olivier",
        "xca": "M 1653pts",
        "xjb": "GONCALVES Michel",
        "xcb": "M 1624pts"
      },
      {
        "xja": "COLSON Mathieu",
        "xca": "M 1721pts",
        "xjb": "PROBST Denis",
        "xcb": "M 1734pts"
      },
      {
        "xja": "MOUGEOT Kevin",
        "xca": "M 1694pts",
        "xjb": "BACHETTI David",
        "xcb": "M 1530pts"
      }
    ],
    "partie": [
      {
        "ja": "BIGOT Florian",
        "scorea": "1",
        "jb": "GORINI Pierre",
        "scoreb": "-",
        "detail": "11 06 -04 -11 12"
      },
      {
        "ja": "DULCY Olivier",
        "scorea": "1",
        "jb": "GONCALVES Michel",
        "scoreb": "-",
        "detail": "06 03 07"
      },
      {
        "ja": "COLSON Mathieu",
        "scorea": "1",
        "jb": "PROBST Denis",
        "scoreb": "-",
        "detail": "12 03 -08 -05 05"
      },
      {
        "ja": "MOUGEOT Kevin",
        "scorea": "1",
        "jb": "BACHETTI David",
        "scoreb": "-",
        "detail": "07 04 09"
      },
      {
        "ja": "BIGOT Florian",
        "scorea": "-",
        "jb": "GONCALVES Michel",
        "scoreb": "1",
        "detail": "07 -07 -10 -11"
      },
      {
        "ja": "DULCY Olivier",
        "scorea": "1",
        "jb": "GORINI Pierre",
        "scoreb": "-",
        "detail": "-07 10 07 07"
      },
      {
        "ja": "MOUGEOT Kevin",
        "scorea": "-",
        "jb": "PROBST Denis",
        "scoreb": "1",
        "detail": "-04 06 -05 10 -08"
      },
      {
        "ja": "COLSON Mathieu",
        "scorea": "1",
        "jb": "BACHETTI David",
        "scoreb": "-",
        "detail": "04 05 04"
      },
      {
        "ja": "BIGOT Florian et COLSON Mathieu",
        "scorea": "1",
        "jb": "GONCALVES Michel et BACHETTI David",
        "scoreb": "-",
        "detail": "-07 -08 04 09 09"
      },
      {
        "ja": "DULCY Olivier et MOUGEOT Kevin",
        "scorea": "1",
        "jb": "GORINI Pierre et PROBST Denis",
        "scoreb": "-",
        "detail": "09 03 -05 06"
      },
      {
        "ja": "BIGOT Florian",
        "scorea": "-",
        "jb": "PROBST Denis",
        "scoreb": "1",
        "detail": "-07 -08 06 -08"
      },
      {
        "ja": "COLSON Mathieu",
        "scorea": "1",
        "jb": "GORINI Pierre",
        "scoreb": "-",
        "detail": "-13 03 -04 04 04"
      },
      {
        "ja": "MOUGEOT Kevin",
        "scorea": "1",
        "jb": "GONCALVES Michel",
        "scoreb": "-",
        "detail": "-07 -07 05 06 06"
      },
      {
        "ja": "DULCY Olivier",
        "scorea": "1",
        "jb": "BACHETTI David",
        "scoreb": "-",
        "detail": "04 03 07"
      }
    ]
  }
}
```


