export interface TourStep {
  route: string;
  selector?: string;
  title: string;
  text: string;
}

export const TOURS: Record<string, { title: string; steps: TourStep[] }> = {
  railway: {
    title: "The railway story",
    steps: [
      { route: "/?ind=HOT40", selector: "[data-tour=map]", title: "Spain's railway, coloured by heat", text: "Each line takes the climate of its NASA MERRA-2 grid cell (~50 km). Press Play to watch days at or above 40 °C grow from the 1980s to today and into 2041–2060." },
      { route: "/", selector: "[data-tour=watch-banner]", title: "Live: this week", text: "Every day we combine the 7-day forecast with 45 years of NASA history to flag where rails will run unusually hot — or cold — for the season." },
      { route: "/watch", selector: "[data-tour=watch-map]", title: "The heat watch", text: "Pulsing dots are sections where the forecast is in the top 1% for that place and month, or where a just-repaired track would have no buckling margin. Try the replays of past heatwaves." },
      { route: "/watch", selector: "[data-tour=watch-brief]", title: "Explain it", text: "The assistant explains the selected place in plain words, from the numbers on screen. If it is unavailable, a rule-based summary is used instead — always labelled." },
      { route: "/", selector: "[data-tour=demo]", title: "Why heat matters", text: "Steel rails expand. Drag the air temperature: on a sunny day the rail runs ~17 °C hotter than the air, and a recently repaired track can kink sideways." },
      { route: "/lab", selector: "[data-tour=lab-presets]", title: "Can you buckle the track?", text: "Move the air temperature, sun and wind: the rail heats up and, past what the track can take, bends sideways. In the cold, the rail pulls until it snaps. The rest of the app feeds these formulas with NASA data." },
      { route: "/network", selector: "[data-tour=net-cards]", title: "The network in 2050", text: "Each stripe is a year of NASA data: km of track with more than ten days at 40 °C. The last block is a typical year in 2050, from six NASA climate models." },
    ],
  },
  trip: {
    title: "Your trip in July",
    steps: [
      { route: "/trip?route=mad-sev&date=2025-08-17", selector: "[data-tour=trip-strip]", title: "Your journey, kilometre by kilometre", text: "Pick any date from 1981 to 2100. Past dates show what NASA measured that day; the next 7 days, the forecast; later dates, the climate of that year." },
      { route: "/trip?route=mad-sev&date=2050-07-15", selector: "[data-tour=trip-cards]", title: "Will the track hold?", text: "The drawn track and the danger for each type of track, plus how we know: measured, forecast, or the projected climate of that year." },
    ],
  },
};
