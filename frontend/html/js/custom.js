function clean_local_storage() {
    // localStorage.removeItem('CLUB_NAME');
    // localStorage.removeItem('CLUB_ID');
    localStorage.removeItem('ORGANISME_REGIONAL_IDS');
    localStorage.removeItem('ORGANISME_DEPARTEMENTAL_IDS');
}

function parse_query_string(query) {
  var vars = query.split("&");
  var query_string = {};
  for (var i = 0; i < vars.length; i++) {
    var pair = vars[i].split("=");
    var key = decodeURIComponent(pair.shift());
    var value = decodeURIComponent(pair.join("="));
    // If first entry with this name
    if (typeof query_string[key] === "undefined") {
      query_string[key] = value;
      // If second entry with this name
    } else if (typeof query_string[key] === "string") {
      var arr = [query_string[key], value];
      query_string[key] = arr;
      // If third or later entry with this name
    } else {
      query_string[key].push(value);
    }
  }
  return query_string;
}

function fetchGetParams() {
  var query = window.location.search.substring(1);
  var qs = parse_query_string(query);
  if (
    qs.club_id != undefined &&
    qs.club_name != undefined &&
    qs.rencontre_choice != undefined
  ) {
    clean_local_storage();
    $('#search-input').val(qs.club_name);
    $('#search-input-id').val(qs.club_id);
    fetchResults(qs.club_id, qs.rencontre_choice);
    // console.log($("#type option:selected").val());
    display_rencontre(qs.club_id, qs.club_name, qs.rencontre_choice);

  } else {
    const storedClubId = localStorage.getItem('CLUB_ID');
    if (storedClubId) {
      fetchResults(storedClubId, null);
    }
    $('#search-input').val(localStorage.getItem('CLUB_NAME'))
    $('#search-input-id').val(localStorage.getItem('CLUB_ID'))
    compute_matchs_select();
  }
};

function submitForm() {
  const selectedValue = $("#type option:selected").val();
  const groupRegex = /(.+) J\d+ \((.+)\)/;

  const matchTextValue = selectedValue.match(groupRegex);
  if (matchTextValue === null) {
    return
  }

  const club_id = $("#search-input-id").val();
  const club_name = $("#search-input").val();
  window.location = '/?club_id=' + club_id
    + '&club_name=' + club_name
    + '&rencontre_choice=' + selectedValue
}

function init_organismes_vars() {
  return new Promise((resolve, reject) => {
    const ORGANISME_NATIONAL_IDS = ['1', '4'];
    var ORGANISME_REGIONAL_IDS;
    var ORGANISME_DEPARTEMENTAL_IDS;
    const storedRegionalIds = localStorage.getItem('ORGANISME_REGIONAL_IDS');
    const storedDepartementalIds = localStorage.getItem('ORGANISME_DEPARTEMENTAL_IDS');
    // TODO force renew data if its old enough (< 2h)
    if (storedRegionalIds && storedDepartementalIds) {
      ORGANISME_REGIONAL_IDS = JSON.parse(storedRegionalIds);
      ORGANISME_DEPARTEMENTAL_IDS = JSON.parse(storedDepartementalIds);
      resolve([ORGANISME_NATIONAL_IDS, ORGANISME_REGIONAL_IDS, ORGANISME_DEPARTEMENTAL_IDS]);
    } else {
      $.ajax({
        url: '/api/organismes?type=L',
        method: 'GET',
        success: function(data) {
          const ORGANISME_REGIONAL = data.liste.organisme;
          const ORGANISME_REGIONAL_IDS = ORGANISME_REGIONAL.map(item => item.id);
          localStorage.setItem('ORGANISME_REGIONAL_IDS', JSON.stringify(ORGANISME_REGIONAL_IDS));
          $.ajax({
            url: '/api/organismes?type=D',
            method: 'GET',
            success: function(data) {
              const ORGANISME_DEPARTEMENTAL = data.liste.organisme;
              const ORGANISME_DEPARTEMENTAL_IDS = ORGANISME_DEPARTEMENTAL.map(item => item.id);
              localStorage.setItem('ORGANISME_DEPARTEMENTAL_IDS', JSON.stringify(ORGANISME_DEPARTEMENTAL_IDS));
              // Resolve the Promise with the values you want to return
              resolve([ORGANISME_NATIONAL_IDS, ORGANISME_REGIONAL_IDS, ORGANISME_DEPARTEMENTAL_IDS]);
            },
            error: function(error) {
              reject(error)
            }
          })
        },
        error: function(error) {
          reject(error)
        }
      })
    }
  })
}

function fetchResults(clubId, rencontre_choice) {
  init_organismes_vars().then(result => {
    [
      ORGANISME_NATIONAL_IDS,
      ORGANISME_REGIONAL_IDS,
      ORGANISME_DEPARTEMENTAL_IDS
    ] = result;
    $.ajax({
      url: '/api/teams?club_id=' + clubId,
      method: 'GET',
      success: function(teams) {
        const promises = teams.map(function(team) {
          return new Promise((resolve, reject) => {
            var division = team.liendivision;
            var match = division.match(/organisme_pere=(\d+)/);
            var organisme_id = match[1];

            let group
            if (ORGANISME_NATIONAL_IDS.includes(organisme_id)) {
                group = 'National';
            } else if (ORGANISME_REGIONAL_IDS.includes(organisme_id)) {
                group = 'Régional';
            } else if (ORGANISME_DEPARTEMENTAL_IDS.includes(organisme_id)) {
                group = 'Départemental';
            } else {
                throw new Error('Unknown group for organisme_id=' + organisme_id);
            }
            $.ajax({
              url: '/api/team/results?' + division,
              method: 'GET',
              success: function(resultData) {
                var tourList = resultData.liste.tour;
                var rencontres = Array.from(new Set(tourList.map(item => item.dateprevue)));
                resolve([group, rencontres]);
              },
              error: function(error) {
                reject(error);
              }
            });
          }).then(([group, rencontres]) => {
            let result = []
            /*
            var now = new Date(); // Get the current date
            rencontres = Array.from(new Set(tourList.map(item => item.dateprevue)))
              .filter(date => {
                var dateParts = date.split('/');
                var dateprevue = new Date(dateParts[2], dateParts[1] - 1, dateParts[0]); // Assuming dateprevue is in the format 'dd/mm/yyyy'
                // Check if dateprevue is earlier than or equal to today (ignoring time)
                return dateprevue <= now || dateprevue.toDateString() === now.toDateString();
              })
            */
            // console.log(rencontres);
            rencontres.forEach(function(date, index) {
                var field = `${group} J${1+index} (${date})`;
                /*
                if (team.libepr !== 'FED_Championnat de France par Equipes Masculin') {
                  field += ' - ' + team.libepr
                }
                */
                field += ' - ' + team.libepr
                // console.log(`${group} J${1+index} (${date})`);
                if (!result.includes(field)) {
                    result.push(field);
                }
            });
            return result
          })
        });

        Promise.all(promises)
        .then((results) => {
          const RENCONTRES = results.flat().filter((value, index, self) => self.indexOf(value) === index);
          RENCONTRES.sort((a, b) => {
            var order = { "National": 1, "Régional": 2, "Départemental": 3 };
            const groupRegex = /(.+) J\d+ \((.+)\)/;

            let groupMatchA = a.match(groupRegex);
            let categoryA = groupMatchA[1];
            let dateA = groupMatchA[2];

            let groupMatchB = b.match(groupRegex);
            let categoryB = groupMatchB[1];
            let dateB = groupMatchB[2];

            // Create a new Date object with the components
            const [dayA, monthA, yearA] = dateA.split('/');
            dateA = new Date(`${yearA}-${monthA}-${dayA}`);
            const [dayB, monthB, yearB] = dateB.split('/');
            dateB = new Date(`${yearB}-${monthB}-${dayB}`);

            // First, sort by the custom order
            const orderComparison = order[categoryA] - order[categoryB];
            if (orderComparison !== 0) {
              return orderComparison;
            }

            // If the categories are the same, sort by date in ascending order
            const dateComparison = dateA - dateB;
            return dateComparison;
            // console.log(RENCONTRES)
          })

          updateBoxShadow(RENCONTRES);
          updateSelectOptions(RENCONTRES, rencontre_choice);
        });
      }
    });
  })
  .catch(error => {
    console.error('Error:', error);
  });
}

// Function to update the box-shadow
function updateBoxShadow(RENCONTRES) {
  const selectElement = document.getElementById('type');
  if (RENCONTRES) {
    selectElement.disabled = false;
    selectElement.style.boxShadow = '';
  } else {
    selectElement.disabled = true;
    selectElement.style.boxShadow = '0 0 0 2px rgba(128, 128, 128, 0.56)';
  }
}

function updateSelectOptions(RENCONTRES, rencontre_choice) {
  var select = $('#type');
  // $('#type option:selected').remove();
  select.empty();
  const resultsDiv = $('#results');
  resultsDiv.empty(); // Clear previous content
  var option = $('<option>', {
    value: 'Veuillez sélectionner une rencontre',
    text: 'Veuillez sélectionner une rencontre'
  });
  select.append(option);
  // $("button[type=submit]").prop("disabled", true);

  RENCONTRES.forEach(function (meeting) {
    var option = $('<option>', {
      value: meeting,
      text: meeting
    });

    // Add a click event to the option
    option.on('click', function () {
      const resultsDiv = $('#results');
      resultsDiv.empty(); // Clear previous content
      submitForm();
    });

    select.append(option);
  });

  if (rencontre_choice !== null) {
    $('#type').find("option[value='" + rencontre_choice + "']").prop('selected', true);
  }
}

function mapResultsToEmoji(team, club_id) {
  const params = team.lien.split('&').reduce((result, param) => {
    const [key, value] = param.split('=');
    result[key] = value;
    return result;
  }, {});

  let scoreClub;
  let scoreOther;

  // console.log([params, club_id])
  if (club_id === params['clubnum_1']) {
    scoreClub = parseInt(team.scorea);
    scoreOther = parseInt(team.scoreb);
  } else if (club_id === params['clubnum_2']) {
    scoreOther = parseInt(team.scorea);
    scoreClub = parseInt(team.scoreb);
  } else {
    throw new Error('club_id does not match clubnum_1 or clubnum_2');
  }

  if (scoreClub > scoreOther) {
    return '🎉'; // Emoji for win
  }
  if (scoreOther > scoreClub) {
    return '😞'; // Emoji for loss
  }
  if (scoreClub === scoreOther) {
    return '🤝'; // Emoji for draw
  }
  return '❓'; // Emoji for unknown
}

function getRankFromTeam(resultRank, teamName) {
  const classement = resultRank.liste.classement;

  for (let i = 0; i < classement.length; i++) {
    if (classement[i].equipe === teamName) {
      const result = classement[i].clt;
      if (result === '1') {
        return '1er'
      } else {
        return result + 'eme' // 2eme, 3eme...
      }
    }
  }

  // If the teamName is not found, you can return a default value or handle the case accordingly.
  return null; // Or any other appropriate value
}

function getPlayerValue(resultTeam, playerName) {
  const playera = resultTeam.liste.joueur.find(player => player.xja === playerName);
  if (playera) {
    if (playera.xca === null) {
      return 0
    }
    const match = playera.xca.match(/(\d+)pts/);
    return parseInt(match[1], 10);
  }
  const playerb = resultTeam.liste.joueur.find(player => player.xjb === playerName);
  if (playerb) {
    if (playerb.xcb === null) {
      return 0
    }
    const match = playerb.xcb.match(/(\d+)pts/);
    return parseInt(match[1], 10);
  }
  return null; // or any other default value
}

function computeGlobalResults(teams, targetGroup, targetDate, club_id, club_name, rencontre_choice) {
  return new Promise((resolve, reject) => {
    let atLeastOneMatchDone = false;
    let resultTeamDetails = {};
    // map least of all promises +
    const promises = teams.map(function(team) {
      return new Promise((resolve, reject) => {
        // console.log(team)
        const libdivision = team.libdivision.replace(/phase /gi, 'P');
        // console.log(libdivision, team)
        var division = team.liendivision;
        var matchDivision = division.match(/organisme_pere=(\d+)/);
        var organisme_id = matchDivision[1];
        var group;
        init_organismes_vars().then(result => {
          [
            ORGANISME_NATIONAL_IDS,
            ORGANISME_REGIONAL_IDS,
            ORGANISME_DEPARTEMENTAL_IDS
          ] = result;
          if (ORGANISME_NATIONAL_IDS.includes(organisme_id)) {
              group = 'National';
          } else if (ORGANISME_REGIONAL_IDS.includes(organisme_id)) {
              group = 'Régional';
          } else if (ORGANISME_DEPARTEMENTAL_IDS.includes(organisme_id)) {
              group = 'Départemental';
          } else {
              // throw new Error('Unknown group for organisme_id=' + organisme_id);
              resolve()
          }

          if (group !== targetGroup) {
            resolve()
            // return
          }

          // Perform a GET request to retrieve team results
          $.ajax({
            url: '/api/team/results?' + division,
            method: 'GET',
            success: function(resultData) {
              var tourList = resultData.liste.tour;
              var filteredTourList = tourList.filter(function (item) {
                return item.dateprevue === targetDate;
              });
              var finalFilteredTourList = filteredTourList.filter(function (item) {
                return item.lien.includes(club_id);
              });

              // Ignore if no matchs for this team
              if (finalFilteredTourList.length === 0) {
                // return
                resolve()
              }

              $.ajax({
                url: '/api/team/rank?' + division,
                method: 'GET',
                success: function(resultRank) {
                  // console.log(finalFilteredTourList)
                  // console.log(resultRank);

                  // Display the results in a div
                  // console.log(finalFilteredTourList)
                  const teamResults = finalFilteredTourList.map((team) => {

                    const lien = team.lien
                    resultTeamDetails[team.lien] = {}
                    $.ajax({
                      url: '/api/result_chp_renc?' + team.lien,
                      method: 'GET',
                      success: function(resultTeam) {
                        if (typeof(resultTeam.liste) !== 'undefined') {
                          resultTeamDetails[team.lien]['details'] = resultTeam
                        }

                        // console.log(resultTeam)

                        // console.log([team, club_id])
                        const emoji = mapResultsToEmoji(team, club_id);
                        if (emoji !== '❓') {
                          // resultTeamDetails[team.lien]['atLeastOneMatchDone'] = true
                          atLeastOneMatchDone = true;
                        }
                        const colDiv = $(`
                          <div class="col-sm-4 teamResultsGlobal"></div>
                        `); // Create a column element
                        const rankEqua = getRankFromTeam(resultRank, team.equa)
                        const rankEqub = getRankFromTeam(resultRank, team.equb)

                        let scoreWin;
                        let teamScorea = 0;
                        let teamScoreb = 0;

                        if (typeof(resultTeam.liste) !== 'undefined') {
                          const hasMatchWithTwoPoints = resultTeam.liste.partie.some(item => {
                              return item.scorea === "2" || item.scoreb === "2";
                          });
                          if (hasMatchWithTwoPoints) {
                            scoreWin = '2';
                          } else {
                            scoreWin = '1';
                          }

                          resultTeam.liste.partie.forEach(partie => {
                            if (partie.ja !== null) {
                              if (scoreWin === '2') {
                                if (!isNaN(parseInt(partie.scorea))) {
                                  teamScorea += Math.max(0, parseInt(partie.scorea) - 1);
                                }
                              } else {
                                const scorea = parseInt(partie.scorea);
                                teamScorea += isNaN(scorea) ? 0 : scorea;
                              }
                            }
                          });

                          resultTeam.liste.partie.forEach(partie => {
                            if (partie.jb !== null) {
                              if (scoreWin === '2') {
                                if (!isNaN(parseInt(partie.scoreb))) {
                                  teamScoreb += Math.max(0, parseInt(partie.scoreb) - 1);
                                }
                              } else {
                                const scoreb = parseInt(partie.scoreb);
                                teamScoreb += isNaN(scoreb) ? 0 : scoreb;
                              }
                            }
                          });

                        }

                        // /result_chp_renc and /team/rank does not map equa and equb so same team sometime
                        // fixing this edge case
                        let customTeamScorea, customTeamScoreb
                        if (typeof(resultTeam.liste) !== 'undefined') {
                          if (team.equa == resultTeam.liste.resultat.equa) {
                            customTeamScorea = teamScorea
                            customTeamScoreb = teamScoreb
                          } else {
                            customTeamScorea = teamScoreb
                            customTeamScoreb = teamScorea
                          }
                        } else {
                          customTeamScorea = ''
                          customTeamScoreb = ''
                        }

                        colDiv.html(`
                          <span style='color: grey'>${libdivision}</span>
                          <br>${emoji} ${team.equa === null ? "" : team.equa.replace(/ /g, '\u00A0')}${rankEqua !== null ? ` (${rankEqua})` : ''} - ${team.equb === null ? "" : team.equb.replace(/ /g, '\u00A0')}${rankEqub !== null ? ` (${rankEqub})` : ''}${(team.scorea !== null && team.scoreb !== null) ? ` | <b>${customTeamScorea}-${customTeamScoreb}</b>` : ""}
                        `);
                        resolve(colDiv)
                      },
                      error: function(resultTeam) {
                        console.log(team.lien, typeof(resultTeam))
                      }
                    })
                  });
                }
              });
            }
          });
        })
      })
    });
    // console.log(promises)
    const rowDivGlobal = $('<div class="row"></div>');
    const colDivGlobalResults = $('<div class="col-sm-8"></div>');
    colDivGlobalResults.append(`
      <hr>
      <span class="padding-bottom--24"
        style="text-align: center; font-size: 20px; line-height: 28px; display: block"
      >
        🏆 Résultats généraux 🏆
      </span>
    `)
    const colDivGlobalPerfs = $('<div class="col-sm-4"></div>');
    const headerColDivGlobalPerfs = `
      <hr>
      <span class="padding-bottom--24"
        style="text-align: center; font-size: 20px; line-height: 28px; display: block"
      >
        🏆 Meilleurs Perfs 🏆
      </span>
    `
    colDivGlobalPerfs.append(headerColDivGlobalPerfs);
    const rowDivGlobalResults = $('<div class="row"></div>');
    const rowDivGlobalPerfs = $('<div class="row"></div>');
    const defaultPerf = $(`
<div class="col-sm-12 d-flex align-items-center justify-content-center">
  <div class="text-center">
    <div class="spinner-border" role="status">
      <span class="sr-only">Loading...</span>
    </div>
  </div>
</div>

    `); // Create a column element
    // defaultPerf.empty();
    Promise.all(promises)
    .then((colDivs) => {

      for (colDiv of colDivs) {
        if (colDiv !== undefined) {
          rowDivGlobalResults.append(colDiv)
        }
      }
      rowDivGlobalPerfs.append(defaultPerf)
      colDivGlobalResults.append(rowDivGlobalResults)
      colDivGlobalPerfs.append(rowDivGlobalPerfs)
      rowDivGlobal.append(colDivGlobalResults)
      rowDivGlobal.append(colDivGlobalPerfs)

      // Compute content for rowDivGlobalPerfs
      $.ajax({
        url: `/api/result_perfs?club_id=${club_id}&club_name=${club_name}&rencontre_choice=${encodeURIComponent(rencontre_choice)}`,
        method: 'GET',
        success: function(perfs) {
          const $ul = $('<ul>');
          perfs.forEach(perf => {
            const $li = $('<li class="teamResultsGlobal">').text(perf);
            $ul.append($li);
          });
          colDivGlobalPerfs.empty();
          colDivGlobalPerfs.append(headerColDivGlobalPerfs);
          colDivGlobalPerfs.append($ul);
        }
      });

      resolve([atLeastOneMatchDone, resultTeamDetails, rowDivGlobal])
    })

  });
}

function display_rencontre(club_id, club_name, selectedValue) {
  const groupRegex = /(.+) J\d+ \((.+)\)/;

  const matchTextValue = selectedValue.match(groupRegex);
  if (matchTextValue === null) {
    // already checked in submit
    return
  }

  const targetGroup = matchTextValue[1];
  const targetDate = matchTextValue[2];

  // console.log("Group:", targetGroup);
  // console.log("Target Date:", targetDate);

  // RENCONTRES = [];
  $.ajax({
    url: '/api/teams?club_id=' + club_id,
    method: 'GET',
    success: function(teams) {

      computeGlobalResults(teams, targetGroup, targetDate, club_id, club_name, selectedValue).then(result => {
        const resultsDiv = $('#results');
        resultsDiv.empty(); // Clear previous content
        let atLeastOneMatchDone, resultTeamDetails, rowDivGlobal;
        [atLeastOneMatchDone, resultTeamDetails, rowDivGlobal] = result
        // console.log([atLeastOneMatchDone, resultTeamDetails, rowDivGlobal])
        resultsDiv.append(rowDivGlobal)
        // console.log('---')
        // console.log(atLeastOneMatchDone)
        // console.log(resultTeamDetails);
        // console.log('---')
        resultsDiv.append(`
          <hr>
        `)

        // console.log([atLeastOneMatchDone, resultTeamDetails])
        if (atLeastOneMatchDone === true) {
        resultsDiv.append(`
          <span class=""
            style="text-align: center; font-size: 20px; line-height: 28px; display: block"
          >
             🏓 Détails des matchs 🏓
          </span>
          <span class="padding-bottom--24"
            style="text-align: center; font-size: 13px; line-height: 28px; display: block"
          >
             📄 Légende 📄 --> 💪=Perf | 💥=Contre
          </span>
        `)

        const rowDivDetails = $('<div class="row"></div>'); // Create a new row
        resultsDiv.append(rowDivDetails);
        const promises = teams.map(function(team) {
          return new Promise((resolve, reject) => {
            // console.log(team)
            const libdivision = team.libdivision.replace(/phase /gi, 'P');
            // console.log(libdivision, team)
            var division = team.liendivision;
            var matchDivision = division.match(/organisme_pere=(\d+)/);
            var organisme_id = matchDivision[1];

            var group;
            if (ORGANISME_NATIONAL_IDS.includes(organisme_id)) {
                group = 'National';
            } else if (ORGANISME_REGIONAL_IDS.includes(organisme_id)) {
                group = 'Régional';
            } else if (ORGANISME_DEPARTEMENTAL_IDS.includes(organisme_id)) {
                group = 'Départemental';
            } else {
                // throw new Error('Unknown group for organisme_id=' + organisme_id);
                resolve()
            }

            if (group !== targetGroup) {
              // continue
              resolve()
            }

            // Perform a GET request to retrieve team results
            $.ajax({
              url: '/api/team/results?' + division,
              method: 'GET',
              success: function(resultData) {
                var tourList = resultData.liste.tour;
                var filteredTourList = tourList.filter(function (item) {
                  return item.dateprevue === targetDate;
                });
                var finalFilteredTourList = filteredTourList.filter(function (item) {
                  return item.lien.includes(club_id);
                });

                // Ignore if no matchs for this team
                if (finalFilteredTourList.length === 0) {
                  // return
                  resolve()
                }

                $.ajax({
                  url: '/api/team/rank?' + division,
                  method: 'GET',
                  success: function(resultRank) {
                    // console.log(finalFilteredTourList)
                    // console.log(resultRank);

                    // Display the results in a div
                    // console.log(finalFilteredTourList)
                    const teamResults = finalFilteredTourList.map((team) => {
                      // console.log(team)
                      let resultTeam = null;
                      resultTeam = resultTeamDetails[team.lien]['details']
                      if (typeof(resultTeam) === 'undefined') {
                        resolve()
                      } // HTTP 400 on fetch /api/result_chp_renc, generally no opposite team
                      // console.log(resultTeam)

                      // Check if score system is 1-0 or 2-1
                      // Loop over all matchs to see if 2 exists
                      let scoreWin;
                      const hasMatchWithTwoPoints = resultTeam.liste.partie.some(item => {
                          return item.scorea === "2" || item.scoreb === "2";
                      });
                      if (hasMatchWithTwoPoints) {
                        scoreWin = '2';
                      } else {
                        scoreWin = '1';
                      }

                      const emoji = mapResultsToEmoji(team, club_id);
                      const colDiv = $(`
                        <div class="col-sm-4 teamResultsDetails"></div>
                      `); // Create a column element
                      const rankEqua = getRankFromTeam(resultRank, team.equa)
                      const rankEqub = getRankFromTeam(resultRank, team.equb)

                      colDiv.html(`
                        <span style='color: grey'>${libdivision}</span>
                        <br>${emoji} ${team.equa === null ? "" : team.equa}${rankEqua !== null ? ` (${rankEqua})` : ''} - ${team.equb === null ? "" : team.equb}${rankEqub !== null ? ` (${rankEqub})` : ''}${(team.scorea !== null && team.scoreb !== null) ? ` | <b>${team.scorea}-${team.scoreb}</b>` : ""}
                        <hr>
                      `);

                      resultTeam.liste.joueur.forEach(player => {
                          colDiv.append(`
                            <div style="text-align: center">
                              ${player.xja === null ? "<i style='color: #212529 !important'>**ABSENT**</i>" : player.xja}<b>${player.xca === null ? "" : ` ${player.xca}`}</b> | ${player.xjb === null ? "<i style='color: #212529 !important'>**ABSENT**</i>" : player.xjb}<b>${player.xcb === null ? "" : ` ${player.xcb}`}</b><br>
                            </div>
                          `);
                      });

                      colDiv.append(`
                        <hr>
                      `);

                      // console.log(resultTeam.liste);

                      // Loop through the "partie" array and display match results
                      resultTeam.liste.partie.forEach(match => {
                        const valuePlayera = getPlayerValue(resultTeam, match.ja)
                        const valuePlayerb = getPlayerValue(resultTeam, match.jb)
                        let emojiPerfa = null;
                        let emojiPerfb = null;
                        if (match.scorea === scoreWin && valuePlayerb - valuePlayera >= 50) {
                          emojiPerfa = "💪";
                          emojiPerfb = "💥";
                          // console.log(match.ja, match.jb, emojiPerfa, emojiPerfb)
                        }
                        if (match.scoreb === scoreWin && valuePlayera - valuePlayerb >= 50) {
                          emojiPerfb = "💪";
                          emojiPerfa = "💥";
                          // console.log(match.ja, match.jb, emojiPerfa, emojiPerfb)
                        }
                        colDiv.append(`
                          <div style="">
                            ${match.ja === null ? `<span><i style="color: red !important">**ABSENT**</i></span> <b>0 - ` : `<span style="color: ${match.scorea === scoreWin ? 'green': 'red'}">${emojiPerfa !== null ? `${emojiPerfa} `: ''}${match.ja}</span> <b>${match.scorea === '-' ? 0 : match.scorea} - `}
                            ${match.jb === null ? ` 0</b> <span><i style="color: red !important">**ABSENT**</i></span>` : `${match.scoreb === '-' ? 0 : match.scoreb}</b> <span style="color: ${match.scoreb === scoreWin ? 'green': 'red'}">${match.jb}${emojiPerfb !== null ? ` ${emojiPerfb}`: ''}</span>`}
                            ${(match.ja !== null && match.jb !== null) ? `<span style="color: grey"> (${match.detail})</span>` : ''}
                            <br>
                          </div>
                        `);
                      });
                      colDiv.append(`
                        <hr>
                      `);
                      resolve(colDiv)
                    });
                  }
                });
              }
            });
          })
        })

        Promise.all(promises)
         .then((colDivs) => {
           for (colDiv of colDivs) {
             if (colDiv !== undefined) {
               rowDivDetails.append(colDiv)
             }
           }
           // resolve();
           resultsDiv.append(`
             <hr>
           `)
         })
        }
      });
    }
  });
}

function search() {
  const input = $('#search-input');
  const value = input.val();
  var club_name = value;
  const result = $('#result');
  result.hide();

  const clubs = $.ajax({
    url: "/api/club/search",
    data: {
      club_name: club_name,
    },
    type: "GET",
    success: function(clubs) {
      const suggestions = $('#suggestions');
      suggestions.html("");

      for (const club of clubs) {
        const div = $('<div>').html(club.club_name);
        div.click(function () {
          input.val(club.club_name);
          $("#search-input-id").val(club.club_id);
          suggestions.hide();
          const club_id = club.club_id;
          localStorage.setItem('CLUB_ID', club.club_id);
          localStorage.setItem('CLUB_NAME', club.club_name);
          compute_matchs_select();
          // Reset rencontres compute on new search club
          fetchResults(club_id);
        });
        suggestions.append(div);
      }
      if (clubs.length === 0) {
        suggestions.hide();
      } else {
        suggestions.show();
      }
    }
  });
}

function compute_matchs_select() {
  const input = $('#search-input');
  const club_name = input.val();
}

function initEvents() {
  updateBoxShadow();
  const selectElement = document.getElementById('type');
  selectElement.addEventListener('change', updateBoxShadow);

  // Get the form element
  const searchForm = document.getElementById("search-community");
  // Add an event listener to the form
  searchForm.addEventListener("submit", function(event) {
    // Prevent the default behavior of the browser
    event.preventDefault();
  });

  document.querySelector('input').addEventListener('keyup', function(event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      document.activeElement.blur();
    }
  });

  $("button[type=submit]").on("click", function(event) {
    event.preventDefault(); // Prevent the default form submission
    submitForm();
  });

  document.getElementById('resetButton').addEventListener('click', function() {
    clean_local_storage();
    window.location = '/';
  });

}


function init() {
  initEvents();
  fetchGetParams();
};

// Check if the page has been loaded
if (performance.navigation.type === 1) {
  // Page has been refreshed, so execute init
  // Call init function when the DOM is ready
  // init();
  $(document).ready(init);
} else {
  // Listen for the pageshow event to execute init
  window.addEventListener('pageshow', init);
}
