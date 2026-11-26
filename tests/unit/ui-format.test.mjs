// Wording and unit formatting (no DOM): units toggle, reasons with numbers, the official notice text.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeUnits, ageText, clock12 } from "../../src/ui/format.js";
import { S, floodReason, beachReason, partialText } from "../../src/ui/strings.js";
import { readFileSync } from "node:fs";

test("units toggle converts US data to metric for display", () => {
  const us = makeUnits("us"), m = makeUnits("metric");
  assert.equal(us.rain(4.24), "4.2 in");
  assert.equal(m.rain(1), "25 mm");
  assert.equal(us.temp(86), "86 °F");
  assert.equal(m.temp(86), "30 °C");
  assert.equal(m.speed(20), "32 km/h");
  assert.equal(us.waves(2), "6.6 ft");
  assert.equal(m.height(1), "0.3 m");
  assert.equal(clock12("22:10"), "10:10 pm");
  assert.equal(clock12("00:05"), "12:05 am");
});

test("reasons say 'estimate' for model rain and name NWS as official", () => {
  const u = makeUnits("us");
  assert.match(floodReason({ code: "rain24", inches: 4.2 }, u), /4\.2 in .*model estimate/);
  assert.match(floodReason({ code: "highTide", ft: 0.53, at: "10:04" }, u), /0\.5 ft above normal high water at 10:04 am/);
  assert.match(beachReason({ code: "nwsBeach", event: "Rip Current Statement" }, u), /official/);
  assert.equal(partialText({ code: "tideNoStation" }), "tides (no confirmed station)");
  assert.equal(ageText(4 * 3600e3), "4 h");
  assert.equal(ageText(25 * 60e3), "25 min");
});

test("not-an-official-warning notice and the Open-Meteo credit are in the static shell", () => {
  const html = readFileSync(new URL("../../public/index.html", import.meta.url), "utf8");
  assert.ok(html.includes(S.NOTICE));
  assert.ok(html.includes('<a href="https://open-meteo.com/">Weather data by Open-Meteo.com</a>'));
  assert.match(S.ALERT_UNKNOWN, /check weather\.gov/);
  assert.doesNotMatch(html, /<script(?![^>]*src=)[^>]*>/); // no inline scripts (CSP)
  assert.doesNotMatch(html, / on[a-z]+=/); // no inline handlers
});
