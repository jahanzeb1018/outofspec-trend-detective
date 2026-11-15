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
      { route: "/watch", selector: "[data-tour=watch-brief]", title: "Ask for a briefing", text: "The assistant writes a three-sentence summary from the numbers on screen. If it is unavailable, a rule-based summary is used instead — always labelled." },
      { route: "/", selector: "[data-tour=demo]", title: "Why heat matters", text: "Steel rails expand. Drag the air temperature: on a sunny day the rail runs ~17 °C hotter than the air, and a recently repaired track can kink sideways." },
      { route: "/lab", selector: "[data-tour=lab-presets]", title: "Does the track hold?", text: "Choose what you know about a section. The FRA-based model turns NASA heat into a buckling safety margin, today and in 2041–2060 — under your assumptions." },
      { route: "/network", selector: "[data-tour=net-cards]", title: "The network in 2050", text: "Kilometres of track moving into hotter classes, fewer frost days, and how much warmer rail must be laid to keep today's margin." },
    ],
  },
  detective: {
    title: "Be a detective in 60 seconds",
    steps: [
      { route: "/detective", selector: "[data-tour=place]", title: "1 · Where?", text: "Click anywhere on the world map, search a city or pick a type of place (desert, rain forest, estuary, big city…)." },
      { route: "/detective", selector: "[data-tour=topic]", title: "2 · What are you curious about?", text: "Pick a topic. The tool suggests NASA measurements that could show a trend." },
      { route: "/detective", selector: "[data-tour=vars]", title: "3 · Choose a measurement", text: "Every option explains the measurement in plain words. Its NASA source and the processes behind it appear with the result." },
      { route: "/detective", selector: "[data-tour=result]", title: "4 · The verdict", text: "Time series, rate of change, Mann-Kendall significance and confidence interval — plus what could cause it. A non-significant trend is still a finding!" },
    ],
  },
  trip: {
    title: "Your trip in July",
    steps: [
      { route: "/trip?route=mad-sev&date=07-15", selector: "[data-tour=trip-strip]", title: "Your journey, kilometre by kilometre", text: "Madrid → Sevilla: where along the way rails get hottest on a typical hot afternoon of your travel date." },
      { route: "/trip?route=mad-sev&date=07-15", selector: "[data-tour=trip-cards]", title: "Your date", text: "How often a very hot day happens around your date — in the 1980s, recently, or in 2041–2060 — plus this week's forecast on your route. Climatological odds, not a weather forecast." },
    ],
  },
};
