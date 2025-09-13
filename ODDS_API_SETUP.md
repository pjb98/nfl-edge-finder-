# The Odds API Setup Guide

This NFL Edge Finder now integrates with **The Odds API** to fetch real historical betting lines from DraftKings, FanDuel, and other major sportsbooks.

## Why The Odds API?

- **Real Betting Lines**: Get actual odds from DraftKings, FanDuel, BetMGM, Caesars, and more
- **Historical Data**: Access betting lines back to 2020 for completed games
- **Free Tier**: 500 requests per month at no cost
- **Comprehensive**: All NFL markets (moneyline, spreads, totals, props)

## Setup Instructions

### 1. Get Your Free API Key

1. Visit [The Odds API](https://the-odds-api.com/)
2. Click "Get Free API Key" 
3. Sign up with your email
4. Verify your email address
5. Copy your API key from the dashboard

### 2. Add API Key to Your Project

#### Option A: Environment Variable (Recommended)
Create a `.env` file in your project root:

```bash
# .env file
REACT_APP_ODDS_API_KEY=your_api_key_here
```

#### Option B: Direct Configuration
Edit `src/services/oddsAPIService.js`:

```javascript
this.apiKey = 'your_api_key_here'; // Replace with your actual key
```

### 3. Restart Your Development Server

```bash
npm run dev
```

## What You'll Get

### With API Key (Real Data)
- ✅ **Real DraftKings Lines**: Actual spreads, totals, moneylines
- ✅ **FanDuel Odds**: Historical betting lines for completed games
- ✅ **Multiple Sportsbooks**: BetMGM, Caesars, Bovada, and more
- ✅ **Consensus Lines**: Average of all available sportsbooks
- ✅ **Historical Accuracy**: Real odds from when games were played

### Without API Key (Fallback)
- ⚠️ **ESPN Odds**: Basic odds from ESPN (when available)
- ⚠️ **Estimated Lines**: Generic betting lines for analysis
- ⚠️ **Limited Accuracy**: Not actual sportsbook data

## API Usage & Pricing

### Free Tier
- **500 requests/month** - Perfect for casual use
- **All sports & markets** included
- **Historical data** back to 2020
- **No credit card** required

### Paid Plans (Optional)
- **$25/month**: 20,000 requests
- **$75/month**: 100,000 requests  
- **Custom plans** for high-volume usage

## Usage Tips

### Optimize API Calls
The app automatically:
- **Caches data** for 10 minutes to reduce API usage
- **Batch requests** for multiple games
- **Falls back** to ESPN if quota exceeded

### Monitor Usage
Check your usage at: https://the-odds-api.com/account

### Request Costs
- **Current odds**: 1 request per call
- **Historical odds**: 10 requests per date/market
- **Smart caching** reduces redundant calls

## Supported Sportsbooks

- **DraftKings** 
- **FanDuel**
- **BetMGM**
- **Caesars**
- **PointsBet**
- **Bovada**
- **BetRivers**
- **FOX Bet**

## Troubleshooting

### "Invalid API Key" Error
- Verify your API key is correct
- Check the `.env` file format
- Restart your development server

### "Quota Exceeded" Error  
- You've used your monthly 500 requests
- App will fall back to ESPN data
- Consider upgrading to a paid plan

### "No Historical Data" Error
- The Odds API has data from 2020+
- Very old games may not have betting data
- App will use estimated lines for analysis

### Games Show "ESPN Odds"
- API key not configured properly
- API quota exceeded for the month
- Historical data not available for that date

## Benefits of Real Betting Lines

### More Accurate Analysis
- **Real market efficiency**: See actual sportsbook margins
- **Historical accuracy**: Analyze based on actual available odds
- **Edge detection**: Find real value vs actual lines, not estimates

### Professional Insights
- **Sportsbook comparison**: See line shopping opportunities  
- **Market movement**: Track how odds changed over time
- **Consensus vs individual**: Compare market consensus to specific books

### Better Betting Strategy
- **Historical performance**: See how your model performed vs real lines
- **ROI tracking**: Calculate returns based on actual available odds
- **Value identification**: Find games where your model disagrees with the market

## Support

- **The Odds API Docs**: https://the-odds-api.com/liveapi/guides/v4/
- **API Status**: https://status.the-odds-api.com/
- **Support Email**: support@the-odds-api.com

With The Odds API integrated, your NFL Edge Finder now provides **professional-grade betting analysis** using real sportsbook data!