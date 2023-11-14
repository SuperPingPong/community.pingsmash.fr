function copyToClipboard() {
  // Get the current URL
  var currentUrl = window.location.href;

  // Create a temporary input element to copy the text
  var tempInput = document.createElement("input");
  tempInput.value = currentUrl;
  document.body.appendChild(tempInput);

  // Select the text in the input element
  tempInput.select();
  tempInput.setSelectionRange(0, 99999); /* For mobile devices */

  // Copy the text to the clipboard
  document.execCommand("copy");

  // Remove the temporary input element
  document.body.removeChild(tempInput);

  // Alert the user that the URL has been copied
  Swal.fire({
    title: "",
    html: "URL copié dans le presse-papiers: <a style='text-decoration: underline' href='" + currentUrl + "'>" + currentUrl + "</a>",
    icon: "success"
  });
}
