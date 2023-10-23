const selectElement = document.getElementById('type');

var ORGANISME_NATIONAL_IDS = ['1'];
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
      // var rencontres = Array.from(new Set(tourList.map(item => item.dateprevue)));
      var now = new Date(); // Get the current date
      var rencontres = Array.from(new Set(tourList.map(item => item.dateprevue)))
        .filter(date => {
          var dateParts = date.split('/');
          var dateprevue = new Date(dateParts[2], dateParts[1] - 1, dateParts[0]); // Assuming dateprevue is in the format 'dd/mm/yyyy'
          // Check if dateprevue is earlier than or equal to today (ignoring time)
          return dateprevue <= now || dateprevue.toDateString() === now.toDateString();
        });

      /*
      var dateList = rencontres.map(date => new Date(date.split('/').reverse().join('/')));
      dateList.sort();
      var formattedDates = dateList.map(date => date.toLocaleDateString('fr-FR'));
      */

      rencontres.forEach(function(date) {
          var field = group + ' - ' + date;
          if (!RENCONTRES.includes(field)) {
              RENCONTRES.push(field);
          }
      });
    }));

    // Output the RENCONTRES array as JSON
    RENCONTRES.sort(function(a, b) {
      var order = { "National": 1, "Régional": 2, "Départemental": 3 };
      return order[a.split(" - ")[0]] - order[b.split(" - ")[0]];
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
      await display_rencontre();
    });

    select.append(option);
  });
}

function mapResultsToEmoji(team) {
  const scoreA = parseInt(team.scorea);
  const scoreB = parseInt(team.scoreb);

  if (scoreA > scoreB) {
    return '🎉'; // Emoji for win
  } else if (scoreA < scoreB) {
    return '😞'; // Emoji for loss
  } else {
    return '😐'; // Emoji for draw
  }
}

async function display_rencontre() {
  const selectedValue = $("#type option:selected").val();
  const regex = /([^-\s]+) - (\d{2}\/\d{2}\/\d{4})/;
  const matchTextValue = selectedValue.match(regex);

  const targetGroup = matchTextValue[1];
  const targetDate = matchTextValue[2];

  console.log("Group:", targetGroup);
  console.log("Target Date:", targetDate);

  // RENCONTRES = [];
  storedClubId = localStorage.getItem('CLUB_ID');
  var teams = await $.ajax({
    url: '/api/teams?club_id=' + storedClubId,
    method: 'GET',
  });

  const resultsDiv = $('#results');
  resultsDiv.empty(); // Clear previous content

  await Promise.all(teams.map(async function (team) {
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
    }

    if (group !== targetGroup) {
      return
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
    /*
    console.log(targetDate)
    console.log(targetGroup)
    console.log(team.libequipe)
    console.log(JSON.stringify(finalFilteredTourList, null, 4));
    console.log('---')
    // var rencontres = Array.from(new Set(tourList.map(item => item.dateprevue)));
    */

    for (const team of finalFilteredTourList) {
      const emoji = mapResultsToEmoji(team);
      console.log(`Team: ${team.equa} - ${team.equb} | Score: ${team.scorea}-${team.scoreb} | Emoji: ${emoji}`);
    }

    // Display the results in a div
    const teamResults = finalFilteredTourList.map((team) => {
      const emoji = mapResultsToEmoji(team);
      return `${emoji} ${team.equa} - ${team.equb} | Score: ${team.scorea}-${team.scoreb}<br />`;
    });
    resultsDiv.append(teamResults.join("<br>"));

  }));
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
