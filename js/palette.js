// Colour palette preview: ?palette=sage|blush|harbour switches the site's colours
// (remembered while browsing); ?palette=clay returns to the default.
// Loaded in <head> so the page doesn't flash the default colours first.
(function () {
  var palettes = ["sage", "blush", "harbour"];
  var choice = new URLSearchParams(window.location.search).get("palette");
  try {
    if (choice) localStorage.setItem("mpc-palette", choice);
    else choice = localStorage.getItem("mpc-palette");
  } catch (e) {}
  if (palettes.indexOf(choice) !== -1) document.documentElement.setAttribute("data-palette", choice);
})();
