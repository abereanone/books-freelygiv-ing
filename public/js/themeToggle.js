function updateThemeIcons(theme) {
  var icon =
    theme === "dark"
      ? "/static/images/light-mode.svg"
      : "/static/images/night-mode.svg";
  document
    .querySelectorAll("#themeBtn img, #themeBtnMobile img")
    .forEach(function (img) {
      img.src = icon;
    });
}

window.onload = function () {
  if (localStorage.getItem("theme")) {
    var theme = localStorage.getItem("theme");
    document.documentElement.setAttribute("data-bs-theme", theme);
    updateThemeIcons(theme);
  }
};

function toggleTheme() {
  if (document.documentElement.getAttribute("data-bs-theme") == "dark") {
    localStorage.setItem("theme", "light");
    document.documentElement.setAttribute("data-bs-theme", "light");
    updateThemeIcons("light");
  } else {
    localStorage.setItem("theme", "dark");
    document.documentElement.setAttribute("data-bs-theme", "dark");
    updateThemeIcons("dark");
  }
}

document.getElementById("themeBtn").addEventListener("click", toggleTheme);
document
  .getElementById("themeBtnMobile")
  .addEventListener("click", toggleTheme);
