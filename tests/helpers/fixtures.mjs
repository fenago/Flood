import { readFileSync } from "node:fs";
export const fx = (name) => JSON.parse(readFileSync(new URL(`../fixtures/${name}`, import.meta.url), "utf8"));
export const config = JSON.parse(readFileSync(new URL("../../public/config/scoring.json", import.meta.url), "utf8"));
export const cities = JSON.parse(readFileSync(new URL("../../public/data/cities.json", import.meta.url), "utf8")).cities;
