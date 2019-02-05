browserify main.js --s bundle | derequire > js/bundle.js
npx babel --plugins remove-comments js/bundle.js  --out-file js/bundle.js
browserify translations.js --s translations | derequire > js/translations.js
npx babel --plugins remove-comments js/translations.js  --out-file js/translations.js
browserify trades.js --s bundle | derequire > js/trades.js
npx babel --plugins remove-comments js/trades.js  --out-file js/trades.js