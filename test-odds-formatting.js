// Test script to verify odds formatting is working correctly
import { formatOddsWithProbability, formatSpreadWithOdds, americanOddsToImpliedProbability } from './src/utils/oddsFormatting.js';

console.log('🧪 Testing NFL Odds Formatting...\n');

// Test American odds to implied probability conversion
console.log('1. Testing implied probability calculations:');
console.log('   -110 odds =', americanOddsToImpliedProbability(-110).toFixed(1) + '%', '(should be ~52.4%)');
console.log('   +200 odds =', americanOddsToImpliedProbability(200).toFixed(1) + '%', '(should be ~33.3%)');
console.log('   -200 odds =', americanOddsToImpliedProbability(-200).toFixed(1) + '%', '(should be ~66.7%)');
console.log('   +100 odds =', americanOddsToImpliedProbability(100).toFixed(1) + '%', '(should be ~50.0%)');

console.log('\n2. Testing odds formatting:');
console.log('   Favorite (-150):', formatOddsWithProbability(-150));
console.log('   Underdog (+175):', formatOddsWithProbability(175));
console.log('   Pick \'em (-110):', formatOddsWithProbability(-110));
console.log('   Big underdog (+350):', formatOddsWithProbability(350));

console.log('\n3. Testing spread formatting:');
console.log('   Home team favored by 7:', formatSpreadWithOdds(-7, -110));
console.log('   Away team favored by 3.5:', formatSpreadWithOdds(3.5, -105));
console.log('   Pick \'em game:', formatSpreadWithOdds(0, -110));

console.log('\n4. Sample betting lines display:');
console.log('   🏈 Chiefs vs Chargers');
console.log('   Moneyline: Chiefs', formatOddsWithProbability(-165), '| Chargers', formatOddsWithProbability(140));
console.log('   Spread:', formatSpreadWithOdds(-3.5, -110));
console.log('   Total: O47.5', formatOddsWithProbability(-110), '| U47.5', formatOddsWithProbability(-110));

console.log('\n✅ Odds formatting test completed!');
console.log('📱 The new format shows American odds like "-110" with implied probability "(52.4%)"');
console.log('🎯 This provides both the standard betting format and probability insights');