export interface CatalogStrategy {
  id: string;
  name: string;
  category: string;
  shortDesc: string;
  definition: string;
  summary: string;
  timeHorizon: string;
  tags: string[];
}

export const STRATEGY_CATALOG: CatalogStrategy[] = [
  // ── Trend Following ──────────────────────────────────────────────────────────
  {
    id: "ema-crossover",
    name: "EMA Crossover",
    category: "Trend Following",
    shortDesc: "9 / 21 EMA crossover for trend entries",
    definition:
      "The EMA Crossover strategy uses two exponential moving averages — a fast (9-period) and a slow (21-period) — to identify directional momentum shifts. A long signal fires when the fast EMA crosses above the slow EMA, indicating buyers are gaining control. A short signal fires on the reverse. Because EMAs weight recent price action more heavily than simple moving averages, the system responds more quickly to momentum shifts while still filtering out minor noise. Best applied on liquid instruments with clear trending behavior; avoid in choppy, range-bound conditions.",
    summary:
      "Enter long when 9 EMA crosses above 21 EMA; exit or short when it crosses below. Works best on trending instruments with clear momentum.",
    timeHorizon: "Day Trade / Swing",
    tags: ["EMA", "Trend", "Crossover"],
  },
  {
    id: "ma-ribbon",
    name: "Moving Average Ribbon",
    category: "Trend Following",
    shortDesc: "5 EMAs fanning out to show trend strength",
    definition:
      "The Moving Average Ribbon plots five EMAs (8, 13, 21, 34, 55) simultaneously. When all five EMAs are fanning out in the same direction and price is riding above (uptrend) or below (downtrend) all of them, trend strength is high. Converging or tangled ribbons signal a weak or indeterminate trend. Traders use the ribbon to time entries by waiting for price to pull back to the ribbon in a strong trend, then enter in the direction of the fan. The Fibonacci-based periods give each line natural separation.",
    summary:
      "Use the spread and direction of five Fibonacci-period EMAs to gauge trend strength. Trade pullbacks to the ribbon in the direction of the fan.",
    timeHorizon: "Swing / Investment",
    tags: ["EMA", "Trend", "Ribbon"],
  },
  {
    id: "supertrend",
    name: "Supertrend",
    category: "Trend Following",
    shortDesc: "ATR-based trailing stop that flips with trend direction",
    definition:
      "The Supertrend indicator draws a trailing stop line using Average True Range (ATR) multiplied by a sensitivity factor (typically 3). When price closes above the line the trend is bullish (line turns green); when price closes below, bearish (line turns red). Each flip from red to green is a buy signal; green to red is a sell signal. The ATR component automatically widens the stop in volatile conditions and tightens it during calm periods, giving the strategy self-adjusting risk parameters. It performs well on strongly trending assets and poorly in sideways markets.",
    summary:
      "Buy when price closes above the ATR-based Supertrend line (turns green); sell when it closes below (turns red). Self-adjusting to volatility.",
    timeHorizon: "Day Trade / Swing",
    tags: ["ATR", "Trend", "Trailing Stop"],
  },

  // ── Momentum ────────────────────────────────────────────────────────────────
  {
    id: "rsi-strategy",
    name: "RSI Strategy",
    category: "Momentum",
    shortDesc: "RSI overbought / oversold reversals",
    definition:
      "The RSI (Relative Strength Index) Strategy uses the 14-period RSI to identify extreme momentum conditions. When RSI drops below 30 the asset is considered oversold — a long entry is triggered on the first candle that closes back above 30 with a stop below the swing low. When RSI rises above 70 the asset is overbought — a short entry triggers on the close back below 70. Profit targets are typically placed at the opposite extreme (70 for longs, 30 for shorts) or at a fixed R-multiple. This is a mean-reversion approach and works best in ranging markets; avoid during strong trends where RSI can stay extreme for extended periods.",
    summary:
      "Buy when RSI crosses back above 30 from oversold; sell when RSI crosses back below 70 from overbought. Works best in ranging conditions.",
    timeHorizon: "Day Trade / Swing",
    tags: ["RSI", "Momentum", "Mean Reversion"],
  },
  {
    id: "macd-crossover",
    name: "MACD Crossover",
    category: "Momentum",
    shortDesc: "MACD line / signal line crossovers",
    definition:
      "The MACD Crossover strategy generates signals when the MACD line (12 EMA minus 26 EMA) crosses the 9-period EMA signal line. A bullish crossover — MACD line crossing above the signal line — is a buy signal, especially when it occurs below the zero line (indicating a shift from bearish to bullish momentum). A bearish crossover above the zero line is a sell signal. The histogram (difference between MACD and signal) provides early warning: shrinking bars in the direction of the trend warn of a potential crossover. Divergence between MACD and price is a powerful confirmation tool.",
    summary:
      "Buy when MACD crosses above its signal line (ideally below zero); sell when it crosses below. Histogram divergence warns of reversals early.",
    timeHorizon: "Swing / Investment",
    tags: ["MACD", "Momentum", "Crossover"],
  },
  {
    id: "stochastic",
    name: "Stochastic Strategy",
    category: "Momentum",
    shortDesc: "%K / %D crossovers in extreme zones",
    definition:
      "The Stochastic Oscillator measures where the closing price falls within its recent high-low range, scaled from 0 to 100. The %K line is the raw value; %D is a 3-period smoothing. A buy signal occurs when %K crosses above %D while both are below 20 (oversold zone). A sell signal occurs when %K crosses below %D while both are above 80 (overbought zone). The strategy is most effective on mean-reverting instruments. Combining Stochastic crossovers with a support/resistance level greatly improves trade quality by avoiding false signals in the middle of the range.",
    summary:
      "Buy when %K crosses above %D below 20 (oversold); sell when %K crosses below %D above 80 (overbought). Best combined with S/R levels.",
    timeHorizon: "Day Trade / Swing",
    tags: ["Stochastic", "Momentum", "Oscillator"],
  },

  // ── Breakout ────────────────────────────────────────────────────────────────
  {
    id: "hod-breakout",
    name: "High of Day Breakout",
    category: "Breakout",
    shortDesc: "Long breakouts above the prior day's high",
    definition:
      "The High of Day (HOD) Breakout strategy enters a long position when price closes decisively above the prior session's high. The setup works because the prior high is a known resistance level that many traders are watching; a confirmed break above it triggers stop-loss orders from shorts and attracts momentum buyers simultaneously, creating a self-reinforcing move. Entry is on a candle close above the HOD level (not just a wick) to avoid false breakouts. Stop is placed just below the breakout candle's low. Targets are set at a fixed R-multiple or at the next visible resistance. High relative volume on the breakout candle is a critical confirmation factor.",
    summary:
      "Enter long on a candle close above the prior session's high with elevated volume. Stop below the breakout candle low; target the next resistance.",
    timeHorizon: "Day Trade",
    tags: ["Breakout", "Price Action", "HOD"],
  },
  {
    id: "gap-and-go",
    name: "Gap and Go",
    category: "Breakout",
    shortDesc: "Morning gap continuation with pre-market volume",
    definition:
      "The Gap and Go strategy captures the continuation of a pre-market gap when it is supported by a fundamental catalyst (earnings beat, FDA approval, analyst upgrade) and strong pre-market volume. At the open, the trader waits for the first 1-5 minute candle to close, then enters on a break of that opening candle's high. The first 5-minute candle high becomes the entry trigger; the low of the opening candle is the stop. The logic is that a gap with catalyst and volume is driven by genuine supply/demand imbalance that will continue into the regular session. Targets are typically the nearest round number or a measured move equal to the gap size.",
    summary:
      "Enter long on a break of the first 5-minute candle high after a catalyst-driven gap up with pre-market volume confirmation.",
    timeHorizon: "Day Trade",
    tags: ["Gap", "Catalyst", "Momentum", "Day Trade"],
  },
  {
    id: "volume-breakout",
    name: "Volume Breakout",
    category: "Breakout",
    shortDesc: "Price breakout confirmed by a volume surge",
    definition:
      "The Volume Breakout strategy waits for price to breach a consolidation level — a prior swing high, a chart pattern boundary, or a trendline — and only takes the trade when volume on the breakout candle is at least 1.5× the 20-period average volume. Volume is the fuel for breakouts: a high-volume break signals institutional participation, while a low-volume break risks a bull trap. Entry is taken on a candle close beyond the key level. Stop is placed below the breakout candle. Traders often use a volume-weighted average price (VWAP) level as an additional filter to ensure the stock is trading in a favorable zone for the breakout to sustain.",
    summary:
      "Enter on a close beyond a key level when volume ≥ 1.5× average. Low-volume breakouts are often bull/bear traps — volume is the key filter.",
    timeHorizon: "Day Trade / Swing",
    tags: ["Volume", "Breakout", "RVOL"],
  },

  // ── Mean Reversion ───────────────────────────────────────────────────────────
  {
    id: "bollinger-band-bounce",
    name: "Bollinger Band Bounce",
    category: "Mean Reversion",
    shortDesc: "Buy lower band, sell upper band with BB squeeze",
    definition:
      "The Bollinger Band Bounce strategy exploits the statistical tendency for price to revert to the 20-period moving average (the middle band) after touching the upper or lower band. The lower band represents roughly two standard deviations below the mean; price touching it while RSI is under 35 produces a high-probability long setup. Price touching the upper band while RSI is above 65 produces a high-probability short. The strategy works best when the bands are contracting (squeeze) after a period of expansion, as this signals decreasing volatility and a potential directional move. Trend filters (e.g., only taking long trades when the 50MA is rising) significantly improve win rate.",
    summary:
      "Buy when price touches the lower Bollinger Band with RSI < 35; target the middle band. Add a trend filter to improve signal quality.",
    timeHorizon: "Swing",
    tags: ["Bollinger Bands", "Mean Reversion", "RSI"],
  },
  {
    id: "vwap-reversion",
    name: "VWAP Reversion",
    category: "Mean Reversion",
    shortDesc: "Snap back to VWAP after an extended deviation",
    definition:
      "VWAP (Volume-Weighted Average Price) acts as the institutional fair value for the session. The VWAP Reversion strategy sells when price extends significantly above VWAP (> 1.5 ATR) and buys when price extends significantly below, expecting a snap back to fair value. The trade is only valid if the broader market is range-bound for the day; trending days see price track one side of VWAP all session. Entries are taken when price shows a rejection candle (bearish engulfing above VWAP, bullish engulfing below). Stop is placed beyond the extreme of the rejection candle. The target is VWAP itself, giving a favorable risk/reward in most cases.",
    summary:
      "Fade extreme deviations from VWAP using rejection candles. Target is VWAP; works only on range-bound days — avoid on trending tape.",
    timeHorizon: "Day Trade",
    tags: ["VWAP", "Mean Reversion", "Intraday"],
  },
  {
    id: "rsi-divergence",
    name: "RSI Divergence",
    category: "Mean Reversion",
    shortDesc: "Price vs RSI divergence signals trend exhaustion",
    definition:
      "RSI Divergence identifies situations where price makes a new high or low but the RSI fails to confirm it, signaling weakening momentum and potential reversal. Bullish divergence: price makes a lower low while RSI makes a higher low — a long setup. Bearish divergence: price makes a higher high while RSI makes a lower high — a short setup. The divergence is confirmed when price breaks the trendline connecting the two RSI pivot points. This is not a standalone signal; it requires structural context — bullish divergence at a major support level carries far more weight than divergence in the middle of a range.",
    summary:
      "Buy bullish divergence (lower price low + higher RSI low) at support; sell bearish divergence at resistance. Confirm with a trendline break.",
    timeHorizon: "Swing / Investment",
    tags: ["RSI", "Divergence", "Reversal"],
  },

  // ── Oscillator ───────────────────────────────────────────────────────────────
  {
    id: "williams-pct-r",
    name: "Williams %R",
    category: "Oscillator",
    shortDesc: "Oversold bounces and overbought fades via %R",
    definition:
      "Williams %R measures where the current close sits within the recent trading range, expressed as a negative value from 0 to -100. Readings from -80 to -100 are considered oversold; -0 to -20 are overbought. The strategy buys when %R crosses above -80 from below (exiting oversold territory) and sells when it crosses below -20 from above (exiting overbought). Because %R is very sensitive and can stay at extremes during strong trends, it's best used with a trend filter: only take long signals when the 50 EMA is rising and short signals when the 50 EMA is falling. This combination dramatically reduces whipsaws.",
    summary:
      "Buy when Williams %R crosses above -80 (leaving oversold); sell when it crosses below -20 (leaving overbought). Use a 50 EMA trend filter.",
    timeHorizon: "Day Trade / Swing",
    tags: ["Williams %R", "Oscillator", "Momentum"],
  },
  {
    id: "cci-strategy",
    name: "CCI Strategy",
    category: "Oscillator",
    shortDesc: "Commodity Channel Index breakouts from ±100",
    definition:
      "The Commodity Channel Index (CCI) measures the distance of price from its statistical mean, scaled by mean deviation. Readings above +100 indicate the asset is in an uptrend phase; readings below -100 indicate a downtrend phase. The Zero-Line Cross strategy enters long when CCI crosses above zero from below, and short when it crosses below zero from above — using the +100/-100 lines as trend-strength confirmation. The Extreme Reversal variant fades moves: sells when CCI reaches +200 and buys when it reaches -200. Both approaches perform better on futures and forex than on equities, which are more trending by nature.",
    summary:
      "Enter long when CCI crosses above zero (confirmed by +100 breach); short when crossing below zero. Fade extremes at ±200 in ranging markets.",
    timeHorizon: "Swing / Investment",
    tags: ["CCI", "Oscillator", "Momentum"],
  },
  {
    id: "stoch-rsi",
    name: "Stochastic RSI",
    category: "Oscillator",
    shortDesc: "RSI of RSI for hyper-sensitive overbought/oversold signals",
    definition:
      "The Stochastic RSI applies the Stochastic formula to RSI values rather than price, making it more sensitive to short-term momentum shifts. Values range from 0 to 1; below 0.2 is oversold, above 0.8 is overbought. A buy signal fires when Stoch RSI crosses above 0.2 from below; a sell signal fires when it crosses below 0.8 from above. Because of its extreme sensitivity, Stoch RSI generates many signals — using it only in the direction of the higher-timeframe trend (e.g., only longs when the daily is above its 50 MA) greatly improves reliability. Best used for timing entries in a confirmed trend rather than for standalone reversal signals.",
    summary:
      "Buy when Stoch RSI crosses above 0.2 from oversold; sell when it crosses below 0.8 from overbought. Requires higher-timeframe trend alignment.",
    timeHorizon: "Day Trade / Swing",
    tags: ["Stochastic RSI", "Oscillator", "Momentum"],
  },

  // ── Pattern ──────────────────────────────────────────────────────────────────
  {
    id: "inside-bar-breakout",
    name: "Inside Bar Breakout",
    category: "Pattern",
    shortDesc: "Volatility contraction → directional expansion",
    definition:
      "An inside bar is a candle whose high and low are entirely within the range of the prior candle (the 'mother bar'). It signals a temporary equilibrium between buyers and sellers — a coiling of energy before a directional release. The Inside Bar Breakout strategy enters above the mother bar's high for a long, or below the mother bar's low for a short, when price breaks out of the inside bar's range with a decisive candle. Stop is placed at the opposite end of the mother bar. The setup is most powerful when the inside bar forms after a strong directional move (as a pause/continuation) rather than in a choppy range.",
    summary:
      "Enter above the mother bar's high on an inside bar breakout. Stop at the mother bar's low. Best as a continuation setup after a strong move.",
    timeHorizon: "Swing",
    tags: ["Price Action", "Pattern", "Volatility"],
  },
  {
    id: "fibonacci-retracement",
    name: "Fibonacci Retracement",
    category: "Pattern",
    shortDesc: "Buy pullbacks to 38.2 / 50 / 61.8 Fib levels",
    definition:
      "The Fibonacci Retracement strategy uses key Fibonacci ratios (23.6%, 38.2%, 50%, 61.8%, 78.6%) drawn from a significant swing low to a swing high (for uptrends) to identify high-probability pullback entry zones. The 38.2% and 61.8% levels are particularly significant as they align with natural mathematical proportions found throughout markets. A long entry is taken when price pulls back to one of these levels and shows a bullish rejection candle (hammer, engulfing, or pin bar). The 61.8% level ('golden ratio') is considered the deepest acceptable pullback for a healthy trend; a close below it often signals trend invalidation.",
    summary:
      "Buy pullbacks to the 38.2%, 50%, or 61.8% Fibonacci level with a bullish rejection candle. A close below 78.6% often invalidates the uptrend.",
    timeHorizon: "Swing / Investment",
    tags: ["Fibonacci", "Retracement", "Price Action"],
  },
];

export const CATEGORIES = [...new Set(STRATEGY_CATALOG.map(s => s.category))];
