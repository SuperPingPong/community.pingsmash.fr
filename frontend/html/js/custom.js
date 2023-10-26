const selectElement = document.getElementById('type');

var ORGANISME_NATIONAL_IDS = ['1', '4'];
var ORGANISME_REGIONAL_IDS;
var ORGANISME_DEPARTEMENTAL_IDS;
var RENCONTRES;

var storedClubName = localStorage.getItem('CLUB_NAME');
var storedClubId = localStorage.getItem('CLUB_ID');
var storedRegionalIds = localStorage.getItem('ORGANISME_REGIONAL_IDS');
var storedDepartementalIds = localStorage.getItem('ORGANISME_DEPARTEMENTAL_IDS');
var storedRencontres = localStorage.getItem('RENCONTRES');
var storedRencontreChoice = localStorage.getItem('RENCONTRE_CHOICE');

async function init_organismes_vars() {
  if (storedRegionalIds && storedDepartementalIds) {
      ORGANISME_REGIONAL_IDS = JSON.parse(storedRegionalIds);
      ORGANISME_DEPARTEMENTAL_IDS = JSON.parse(storedDepartementalIds);
  } else {
    var ORGANISME_NATIONAL_IDS = ['1'];
    await $.ajax({
      url: '/api/organismes?type=L',
      method: 'GET',
    }).then(function(data) {
      const ORGANISME_REGIONAL = data.liste.organisme;
      ORGANISME_REGIONAL_IDS = ORGANISME_REGIONAL.map(item => item.id);
      localStorage.setItem('ORGANISME_REGIONAL_IDS', JSON.stringify(ORGANISME_REGIONAL_IDS));
    })
    await $.ajax({
      url: '/api/organismes?type=D',
      method: 'GET',
    }).then(function(data) {
      const ORGANISME_DEPARTEMENTAL = data.liste.organisme;
      ORGANISME_DEPARTEMENTAL_IDS = ORGANISME_DEPARTEMENTAL.map(item => item.id);
      localStorage.setItem('ORGANISME_DEPARTEMENTAL_IDS', JSON.stringify(ORGANISME_DEPARTEMENTAL_IDS));
    })
  }
}

async function fetchResults(clubId) {
  if (storedRencontres) {
      RENCONTRES = JSON.parse(storedRencontres);
  } else {
    RENCONTRES = [];
    var teams = await $.ajax({
      url: '/api/teams?club_id=' + clubId,
      method: 'GET',
    });

    await Promise.all(teams.map(async function (team) {
      var division = team.liendivision;
      var match = division.match(/organisme_pere=(\d+)/);
      var organisme_id = match[1];

      var group;
      if (ORGANISME_NATIONAL_IDS.includes(organisme_id)) {
          group = 'National';
      } else if (ORGANISME_REGIONAL_IDS.includes(organisme_id)) {
          group = 'Régional';
      } else if (ORGANISME_DEPARTEMENTAL_IDS.includes(organisme_id)) {
          group = 'Départemental';
      } else {
          throw new Error('Unknown group for organisme_id=' + organisme_id);
      }

      // Perform a GET request to retrieve team results
      var resultData = await $.ajax({
        url: '/api/team/results?' + division,
        method: 'GET',
      });

      var tourList = resultData.liste.tour;
      // console.log(JSON.stringify(tourList, null, 4));
      var rencontres = Array.from(new Set(tourList.map(item => item.dateprevue)));
      // console.log(JSON.stringify(rencontres, null, 4));

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

      rencontres.forEach(function(date, index) {
          var field = `${group} J${1+index} (${date})`;
          if (!RENCONTRES.includes(field)) {
              RENCONTRES.push(field);
          }
      });
    }));

    // Output the RENCONTRES array as JSON
    // console.log(RENCONTRES)
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
    });

    localStorage.setItem('RENCONTRES', JSON.stringify(RENCONTRES));
    // console.log(JSON.stringify(RENCONTRES, null, 4));
  }
  await updateBoxShadow();
  await updateSelectOptions();
}

// Function to update the box-shadow
async function updateBoxShadow() {
  storedRencontres = localStorage.getItem('RENCONTRES');
  if (storedRencontres) {
    selectElement.disabled = false;
    selectElement.style.boxShadow = '';
  } else {
    selectElement.disabled = true;
    selectElement.style.boxShadow = '0 0 0 2px rgba(128, 128, 128, 0.56)';
  }
}

async function updateSelectOptions() {
  storedRencontres = localStorage.getItem('RENCONTRES');
  RENCONTRES = JSON.parse(storedRencontres);
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
    option.on('click', async function () {
      localStorage.setItem('RENCONTRE_CHOICE', $(this).val());
      const resultsDiv = $('#results');
      resultsDiv.empty(); // Clear previous content
      // $("button[type=submit]").prop("disabled", false).css("cursor", "pointer");
      await display_rencontre();
    });

    select.append(option);
  });
}

function mapResultsToEmoji(team) {
  const params = team.lien.split('&').reduce((result, param) => {
    const [key, value] = param.split('=');
    result[key] = value;
    return result;
  }, {});

  let scoreClub;
  let scoreOther;

  // console.log(params)
  storedClubId = localStorage.getItem('CLUB_ID');
  if (storedClubId === params['clubnum_1']) {
    scoreClub = parseInt(team.scorea);
    scoreOther = parseInt(team.scoreb);
  } else if (storedClubId === params['clubnum_2']) {
    scoreOther = parseInt(team.scorea);
    scoreClub = parseInt(team.scoreb);
  } else {
    throw new Error('storedClubId does not match clubnum_1 or clubnum_2');
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

async function display_rencontre() {
  const selectedValue = $("#type option:selected").val();
  const groupRegex = /(.+) J\d+ \((.+)\)/;

  const matchTextValue = selectedValue.match(groupRegex);
  if (matchTextValue === null) {
    return
  }

  const targetGroup = matchTextValue[1];
  const targetDate = matchTextValue[2];

  // console.log("Group:", targetGroup);
  // console.log("Target Date:", targetDate);

  // RENCONTRES = [];
  storedClubId = localStorage.getItem('CLUB_ID');
  var teams = await $.ajax({
    url: '/api/teams?club_id=' + storedClubId,
    method: 'GET',
  });

  const resultsDiv = $('#results');
  resultsDiv.empty(); // Clear previous content
  resultsDiv.append(`
    <span class="padding-bottom--24"
      style="text-align: center; font-size: 20px; line-height: 28px; display: block"
    >
       🏆 Résultats généraux 🏆
    </span>
  `)
  const rowDivGlobal = $('<div class="row"></div>'); // Create a new row
  resultsDiv.append(rowDivGlobal)

  var atLeastOneMatchDone = false;
  var resultTeamDetails = {};

  for (const team of teams) {
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
        throw new Error('Unknown group for organisme_id=' + organisme_id);
    }

    if (group !== targetGroup) {
      continue
    }

    // Perform a GET request to retrieve team results
    var resultData = await $.ajax({
      url: '/api/team/results?' + division,
      method: 'GET',
    });

    var tourList = resultData.liste.tour;
    var filteredTourList = tourList.filter(function (item) {
      return item.dateprevue === targetDate;
    });
    var finalFilteredTourList = filteredTourList.filter(function (item) {
      return item.lien.includes(storedClubId);
    });

    // Ignore if no matchs for this team
    if (finalFilteredTourList.length === 0) {
      continue
    }

    var resultRank = await $.ajax({
      url: '/api/team/rank?' + division,
      method: 'GET',
    });

    // console.log(finalFilteredTourList)
    // console.log(resultRank);

    // Display the results in a div
    // console.log(finalFilteredTourList)
    const teamResults = finalFilteredTourList.map(async (team) => {

      const lien = team.lien
      var resultTeam = await $.ajax({
        url: '/api/result_chp_renc?' + team.lien,
        method: 'GET',
      }).catch(function (response) {
        // console.error(`HTTP 400 error: Bad Request for URL: /api/result_chp_renc?${team.lien}`);
        // HTTP 400 on fetch /api/result_chp_renc, generally no opposite team
        console.log(response)
      })

      if (typeof(resultTeam) !== 'undefined') {
        resultTeamDetails[team.lien] = resultTeam
      }

      // console.log(resultTeam)

      const emoji = mapResultsToEmoji(team);
      if (emoji !== '❓') {
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

      if (typeof(resultTeam) !== 'undefined') {
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
              teamScorea += Math.max(0, parseInt(partie.scorea) - 1);
            } else {
              teamScorea += parseInt(partie.scorea);
            }
          }
        });

        resultTeam.liste.partie.forEach(partie => {
          if (partie.jb !== null) {
            if (scoreWin === '2') {
              teamScoreb += Math.max(0, parseInt(partie.scoreb) - 1);
            } else {
              teamScoreb += parseInt(partie.scoreb);
            }
          }
        });

      }

      colDiv.html(`
        <span style='color: grey'>${libdivision}</span>
        <br>${emoji} ${team.equa === null ? "" : team.equa}${rankEqua !== null ? ` (${rankEqua})` : ''} - ${team.equb === null ? "" : team.equb}${rankEqub !== null ? ` (${rankEqub})` : ''}${(team.scorea !== null && team.scoreb !== null) ? ` | <b>${teamScorea}-${teamScoreb}</b>` : ""}
      `);
      rowDivGlobal.append(colDiv); // Append the column to the current row
    });
  };
  resultsDiv.append(`
    <hr>
  `)
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
  for (const team of teams) {
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
        throw new Error('Unknown group for organisme_id=' + organisme_id);
    }

    if (group !== targetGroup) {
      continue
    }

    // Perform a GET request to retrieve team results
    var resultData = await $.ajax({
      url: '/api/team/results?' + division,
      method: 'GET',
    });

    var tourList = resultData.liste.tour;
    var filteredTourList = tourList.filter(function (item) {
      return item.dateprevue === targetDate;
    });
    var finalFilteredTourList = filteredTourList.filter(function (item) {
      return item.lien.includes(storedClubId);
    });

    // Ignore if no matchs for this team
    if (finalFilteredTourList.length === 0) {
      continue
    }

    var resultRank = await $.ajax({
      url: '/api/team/rank?' + division,
      method: 'GET',
    });

    // console.log(finalFilteredTourList)
    // console.log(resultRank);

    // Display the results in a div
    // console.log(finalFilteredTourList)
    const teamResults = finalFilteredTourList.map(async (team) => {
      // console.log(team)
      let resultTeam = null;
      resultTeam = resultTeamDetails[team.lien]
      if (typeof(resultTeam) === 'undefined') {
        return
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


      const emoji = mapResultsToEmoji(team);
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
            ${match.ja === null ? `<span><i style="color: red !important">**ABSENT**</i></span> <b>0 - ` : `<span style="color: ${match.scorea === scoreWin ? 'green': 'red'}">${emojiPerfa !== null ? `${emojiPerfa} `: ''}${match.ja}</span> <b>${match.scorea} - `}
            ${match.jb === null ? ` 0</b> <span><i style="color: red !important">**ABSENT**</i></span>` : `${match.scoreb}</b> <span style="color: ${match.scoreb === scoreWin ? 'green': 'red'}">${match.jb}${emojiPerfb !== null ? ` ${emojiPerfb}`: ''}</span>`}
            ${(match.ja !== null && match.jb !== null) ? `<span style="color: grey"> (${match.detail})</span>` : ''}
            <br>
          </div>
        `);
      });

      colDiv.append(`
        <hr>
      `);

      rowDivDetails.append(colDiv); // Append the column to the current row
    });
  };
  resultsDiv.append(`
    <hr>
  `)
  }
}

async function search() {
  const input = $('#search-input');
  const value = input.val();
  var club_name = value;
  const result = $('#result');
  result.hide();

  const clubs = await $.ajax({
    url: "/api/club/search",
    data: {
      club_name: club_name,
    },
    type: "GET",
  });

  const suggestions = $('#suggestions');
  suggestions.html("");

  for (const club of clubs) {
    const div = $('<div>').html(club.club_name);
    div.click(async function () {
      input.val(club.club_name);
      localStorage.setItem('CLUB_NAME', club.club_name);
      localStorage.setItem('CLUB_ID', club.club_id);
      suggestions.hide();
      const club_id = club.club_id;
      const teams = await $.ajax({
        url: "/api/teams",
        data: {
          club_id: club_id,
        },
        type: "GET",
      });
      // console.log(teams);
      compute_matchs_select();
      // Reset rencontres compute on new search club
      localStorage.removeItem('RENCONTRES');
      localStorage.removeItem('RENCONTRE_CHOICE');
      storedRencontres = localStorage.getItem('RENCONTRES');
      storedRencontreChoice = localStorage.getItem('RENCONTRE_CHOICE');
      await fetchResults(club_id);
    });
    suggestions.append(div);
  }

  if (clubs.length === 0) {
    suggestions.hide();
  } else {
    suggestions.show();
  }
}

function compute_matchs_select() {
  const input = $('#search-input');
  const club_name = input.val();
  // console.log(club_name)
}

async function init2() {
  updateBoxShadow();
  selectElement.addEventListener('change', updateBoxShadow);

  if (storedClubId) {
    await fetchResults(storedClubId);
    // console.log(JSON.stringify(RENCONTRES, null, 4));
  }

  const input = $('#search-input');
  input.val(storedClubName);

  compute_matchs_select();

  if (storedRencontreChoice) {
    for (const option of selectElement.options) {
      if (option.value === storedRencontreChoice) {
        option.selected = true;
        break;
      }
    }
    $("button[type=submit]").prop("disabled", false).css("cursor", "pointer");
  }

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

  $("button[type=submit]").on("click", async function(event) {
    event.preventDefault(); // Prevent the default form submission
    await display_rencontre();
  });

  document.getElementById('resetButton').addEventListener('click', function() {
    localStorage.removeItem('CLUB_NAME');
    localStorage.removeItem('CLUB_ID');
    localStorage.removeItem('ORGANISME_REGIONAL_IDS');
    localStorage.removeItem('ORGANISME_DEPARTEMENTAL_IDS');
    localStorage.removeItem('RENCONTRES');
    localStorage.removeItem('RENCONTRE_CHOICE');
    /*
    storedClubName = localStorage.getItem('CLUB_NAME');
    storedClubId = localStorage.getItem('CLUB_ID');
    storedRegionalIds = localStorage.getItem('ORGANISME_REGIONAL_IDS');
    storedDepartementalIds = localStorage.getItem('ORGANISME_DEPARTEMENTAL_IDS');
    storedRencontres = localStorage.getItem('RENCONTRES');
    storedRencontreChoice = localStorage.getItem('RENCONTRE_CHOICE');
    */
    var select = $('#type');
    // $('#type option:selected').remove();
    select.empty();
    var option = $('<option>', {
      value: 'Veuillez choisir un nom de club',
      text: 'Veuillez choisir un nom de club'
    });
    select.append(option);
    const resultsDiv = $('#results');
    resultsDiv.empty(); // Clear previous content
    updateBoxShadow();
  });
}


async function init() {
  await init_organismes_vars();
  await init2();
};

// Listen for the pageshow event
window.addEventListener('pageshow', init);

// Call init function when the DOM is ready
$(document).ready(init);
