/* eslint-env browser */
/* global $, EJS, google */

const Web3 = require('web3');
const BigNumber = require('bignumber.js');
const async = require('async');
const request = require('request');
const sha3 = require('web3/lib/utils/sha3.js');
const SolidityEvent = require('web3/lib/web3/event.js');
const stats = require('stats-lite');

const addressDEx = '0x54477a3abc9355711bce1c7f150e9129090dcdce';
const addressToken = '0x51ba4d11f6ed41748f8ebcb1890efb6d3e369f59';

const web3 = new Web3();
const provider = 'http://localhost:8545';
web3.setProvider(new Web3.providers.HttpProvider(provider));

function TradeUtil() {
  const self = this;
  self.contractDEx = null;
  self.contractToken = null;
  self.blockNumber = 0;
  self.latestBlock = 0;
  self.earliestBlock = 0;
  self.eventsCache = {};
  self.tradesCache = [];
  self.tokens = {
    '0x0000000000000000000000000000000000000000': {
      addr: '0x0000000000000000000000000000000000000000',
      name: 'ETH',
      decimals: 18,
    },
  };
  self.inputEthereumAddress = null;
  self.inputTokenAddress = null;
  window.addEventListener('load', () => {
    self.initialize(() => {
      console.log('Finished initializing', self.blockNumber);
    });
  });

  self.get = function get(url, callback) {
    request.get(url, {}, (err, httpResponse, body) => {
      if (err) {
        callback(err, null);
      } else {
        try {
          const result = JSON.parse(body);
          callback(null, result);
        } catch (errTry) {
          callback(errTry, null);
        }
      }
    });
  };

  self.getContract = function getContract(callback) {
    self.get(`https://api.etherscan.io/api?module=contract&action=getabi&address=${addressDEx}`, (err, data) => {
      if (err) throw new Error(err);
      const abi = JSON.parse(data.result);
      self.contractDEx = web3.eth.contract(abi);
      self.contractDEx = self.contractDEx.at(addressDEx);
      callback(null, self.contractDEx);
    });
  };

  self.getContractToken = function getContractToken(callback) {
    self.get(`https://api.etherscan.io/api?module=contract&action=getabi&address=${addressToken}`, (err, data) => {
      if (err) throw new Error(err);
      const abi = JSON.parse(data.result);
      self.contractToken = web3.eth.contract(abi);
      self.contractToken = self.contractToken.at(addressToken);
      callback(null, self.contractToken);
    });
  };

  self.getBlockNumber = function getBlockNumber(callback) {
    self.get('https://api.etherscan.io/api?module=proxy&action=eth_blockNumber', (err, data) => {
      if (!err) {
        const newBlockNumber = web3.toDecimal(data.result);
        if (newBlockNumber > 0) {
          self.blockNumber = newBlockNumber;
        }
        callback(null, self.blockNumber);
      } else {
        callback(null, self.blockNumber);
      }
    });
  };

  self.getLog = function getLog(fromBlock, toBlock, callback) {
    function decodeEvent(item) {
      const eventAbis = self.contractDEx.abi.filter(eventAbi => (
          eventAbi.type === 'event' &&
          item.topics[0] ===
            `0x${
              sha3(
                `${eventAbi.name
                  }(${
                  eventAbi.inputs
                    .map(x => x.type)
                    .join()
                  })`)}`
        ));
      if (eventAbis.length > 0) {
        const eventAbi = eventAbis[0];
        const event = new SolidityEvent(web3, eventAbi, addressDEx);
        const result = event.decode(item);
        return result;
      }
      return null;
    }
    const url =
      `https://api.etherscan.io/api?module=logs&action=getLogs&address=${addressDEx}&fromBlock=${fromBlock}&toBlock=${toBlock}`;
    self.get(url, (err, data) => {
      if (!err) {
        try {
          const items = data.result;
          async.map(
            items,
            (item, callbackMap) => {
              Object.assign(item, {
                blockNumber: parseInt(item.blockNumber, 16),
                logIndex: parseInt(item.logIndex, 16),
                transactionIndex: parseInt(item.transactionIndex, 16),
              });
              const event = decodeEvent(item);
              callbackMap(null, event);
            },
            (errMap, events) => {
              callback(null, events);
            });
        } catch (errTry) {
          callback(errTry, []);
        }
      } else {
        callback(err, []);
      }
    });
  };

  self.getCall = function getCall(contract, addr, fn, args, callback) {
    const data = contract[fn].getData.apply(null, args);
    const url = `https://api.etherscan.io/api?module=proxy&action=eth_call&to=${addr}&data=${data}&tag=latest`;
    self.get(url, callback);
  };

  self.getTokenInfo = function getTokenInfo(addr, callback) {
    if (self.tokens[addr]) {
      callback(null, self.tokens[addr]);
    } else {
      self.getCall(self.contractToken, addr, 'symbol', [], (errSymbol, dataSymbol) => {
        self.getCall(self.contractToken, addr, 'decimals', [], (errDecimals, dataDecimals) => {
          if (!errSymbol && !errDecimals) {
            try {
              const symbol = web3.toAscii(dataSymbol.result).replace(/[\u{0000}-\u{0020}]/gu, '');
              const decimals = web3.toDecimal(dataDecimals.result);
              self.tokens[addr] = {
                addr,
                decimals,
                name: symbol,
              };
            } catch (err) {
              console.log('Error getting token', addr);
            }
            callback(null, self.tokens[addr]);
          } else {
            callback('Failed to get token', null);
          }
        });
      });
    }
  };

  self.processTrades = function processTrades(events, filter, callback) {
    let i = 0;
    async.eachSeries(
      events,
      (event, callbackEach) => {
        i += 1;
        self.ejs('trades_progress.ejs', 'trades_progress', {
          percent: Math.round((100 * i) / events.length),
          display: true,
        });
        if (event.event === 'Trade') {
          self.getTokenInfo(event.args.tokenGet, (errTokenGet, tokenGet) => {
            self.getTokenInfo(event.args.tokenGive, (errTokenGive, tokenGive) => {
              if (!errTokenGet && !errTokenGive && tokenGet && tokenGive) {
                try {
                  const amountGet = event.args.amountGet
                    .div(new BigNumber(10).pow(new BigNumber(tokenGet.decimals)));
                  const amountGive = event.args.amountGive
                    .div(new BigNumber(10).pow(new BigNumber(tokenGive.decimals)));
                  const trade = {
                    txHash: event.transactionHash,
                    tokenGet,
                    tokenGive,
                    amountGet,
                    amountGive,
                    get: event.args.get,
                    give: event.args.give,
                    date: new Date(parseInt(event.timeStamp, 16) * 1000),
                  };
                  if ((trade.tokenGet.name === 'ETH' || trade.tokenGive.name === 'ETH')
                   && trade.amountGive.gt(0) && trade.amountGet.gt(0)
                  ) {
                    self.tradesCache.push(trade);
                  }
                } catch (err) {
                  console.log(err);
                }
                setTimeout(callbackEach, 0);
              } else {
                setTimeout(callbackEach, 0);
              }
            });
          });
        } else {
          setTimeout(callbackEach, 0);
        }
      },
      () => {
        callback(null);
      });
  };

  self.downloadTrades = function downloadTrades(kind, filter, callback) {
    self.getBlockNumber(() => {
      const ranges = [];
      if (kind === 'earlier') {
        let block = self.earliestBlock;
        const perBlock = 250;
        const n = 5;
        for (let i = 0; i < n && block > 0; i += 1) {
          ranges.push([Math.max(block - perBlock, 1), block]);
          block -= perBlock;
        }
      } else if (kind === 'later') {
        let block = self.latestBlock;
        const perBlock = 250;
        const n = 10;
        for (let i = 0; i < n && block <= self.blockNumber; i += 1) {
          ranges.push([block, Math.min(block + perBlock, self.blockNumber)]);
          block += perBlock;
        }
      }
      let i = 0;
      async.mapSeries(
        ranges,
        (range, callbackMap) => {
          self.getLog(range[0], range[1], (err, events) => {
            i += 1;
            self.ejs('trades_progress.ejs', 'trades_progress', {
              percent: Math.round((100 * i) / ranges.length),
              display: true,
            });
            callbackMap(err, events);
          });
        },
        (err, events) => {
          const newEvents = [];
          if (err) {
            callback(err, []);
          } else {
            const merged = [].concat.apply([], events); // eslint-disable-line
            merged.forEach((event) => {
              if (!self.eventsCache[event.transactionHash]) {
                newEvents.push(event);
                self.eventsCache[event.transactionHash] = event;
              }
            });
            self.processTrades(newEvents, filter, () => {
              if (kind === 'earlier' && ranges.length > 0) {
                self.earliestBlock = ranges[ranges.length - 1][0];
              } else if (kind === 'later' && ranges.length > 0) {
                self.latestBlock = ranges[ranges.length - 1][1];
              }
              self.ejs('trades_nav.ejs', 'trades_nav', {
                earliestBlock: self.earliestBlock,
                latestBlock: self.latestBlock,
                inputEthereumAddress: self.inputEthereumAddress,
                inputTokenAddress: self.inputTokenAddress,
              });
              const trades = self.tradesCache.filter(trade =>
                (!filter.inputTokenAddress ||
                 (trade.tokenGet.addr.toLowerCase() === filter.inputTokenAddress.toLowerCase() ||
                  trade.tokenGive.addr.toLowerCase() === filter.inputTokenAddress.toLowerCase())) &&
                (!filter.inputEthereumAddress ||
                  (trade.get.toLowerCase() === filter.inputEthereumAddress.toLowerCase() ||
                   trade.give.toLowerCase() === filter.inputEthereumAddress.toLowerCase())));
              trades.sort((a, b) => b.date - a.date);

              self.ejs('trades_progress.ejs', 'trades_progress', {
                display: false,
                progress: 0,
              });
              self.ejs('trades_list.ejs', 'trades_list', { trades });
              self.drawChart(filter);
              callback(null, trades);
            });
          }
        });
    });
  };

  self.initialize = function initialize(callback) {
    async.parallel(
      [
        self.getContract,
        self.getContractToken,
        self.getBlockNumber,
      ],
      () => {
        self.earliestBlock = self.blockNumber;
        self.latestBlock = self.blockNumber;
        self.ejs('trades_nav.ejs', 'trades_nav', {
          earliestBlock: self.earliestBlock,
          latestBlock: self.latestBlock,
          inputEthereumAddress: self.inputEthereumAddress,
          inputTokenAddress: self.inputTokenAddress,
        });
        self.downloadTrades(null, {}, () => {
          callback();
        });
      });
  };

  self.clickEarlier = function clickEarlier() {
    self.inputEthereumAddress = $('#inputEthereumAddress').val();
    self.inputTokenAddress = $('#inputTokenAddress').val();
    $('#clickEarlier').prop('disabled', true);
    $('#clickLater').prop('disabled', true);
    self.downloadTrades('earlier', {
      inputEthereumAddress: self.inputEthereumAddress,
      inputTokenAddress: self.inputTokenAddress,
    }, () => {
      console.log('Downloaded trades');
    });
  };

  self.clickLater = function clickLater() {
    self.inputEthereumAddress = $('#inputEthereumAddress').val();
    self.inputTokenAddress = $('#inputTokenAddress').val();
    $('#clickEarlier').prop('disabled', true);
    $('#clickLater').prop('disabled', true);
    self.downloadTrades('later', {
      inputEthereumAddress: self.inputEthereumAddress,
      inputTokenAddress: self.inputTokenAddress,
    }, () => {
      console.log('Downloaded trades');
    });
  };

  self.clickFilter = function clickLater() {
    self.inputEthereumAddress = $('#inputEthereumAddress').val();
    self.inputTokenAddress = $('#inputTokenAddress').val();
    self.downloadTrades(null, {
      inputEthereumAddress: self.inputEthereumAddress,
      inputTokenAddress: self.inputTokenAddress,
    }, () => {
      console.log('Filtered trades');
    });
  };

  self.drawChart = function drawChart(filter) {
    $('#trades_chart').html('');
    if (filter.inputTokenAddress) {
      const trades = self.tradesCache.filter(trade =>
        (!filter.inputTokenAddress ||
         (trade.tokenGet.addr.toLowerCase() === filter.inputTokenAddress.toLowerCase() ||
          trade.tokenGive.addr.toLowerCase() === filter.inputTokenAddress.toLowerCase())))
      .sort((a, b) => a.date - b.date);

      const rows = trades.map((trade) => {
        const price = trade.tokenGet.name === 'ETH' ?
          trade.amountGet.div(trade.amountGive).toNumber() :
          trade.amountGive.div(trade.amountGet).toNumber();
        return [trade.date, price];
      });

      const values = rows.map(x => x[1]);
      const phigh = stats.percentile(values, 0.95);
      const plow = stats.percentile(values, 0.05);

      const filteredRows = rows.filter(x => x[1] >= plow && x[1] <= phigh);

      if (filteredRows.length > 1) {
        const interval = 1 * 60 * 60 * 1000;
        let start = filteredRows[0][0];
        let points = [];
        const intervals = [];
        filteredRows.forEach((row) => {
          const [date, point] = row;
          if (date - start > interval) {
            if (points.length > 0) {
              const low = Math.min.apply(null, points);
              const high = Math.max.apply(null, points);
              const open = points[0];
              const close = points[points.length - 1];
              if (close > open) {
                intervals.push([start, low, open, close, high]);
              } else {
                intervals.push([start, high, close, open, low]);
              }
            }
            start = new Date(start.getTime() + interval);
            points = [];
          }
          points.push(point);
        });

        const data = google.visualization.arrayToDataTable(intervals, true);

        const options = {
          width: 900,
          height: 500,
          legend: { position: 'none' },
          enableInteractivity: false,
          chartArea: {
            width: '85%',
          },
          hAxis: {
            viewWindow: {
              min: filteredRows[0].date,
              max: filteredRows[filteredRows.length - 1].date,
            },
            gridlines: {
              count: -1,
              units: {
                days: { format: ['MMM dd'] },
                hours: { format: ['HH:mm', 'ha'] },
              },
            },
            minorGridlines: {
              units: {
                hours: { format: ['hh:mm:ss a', 'ha'] },
                minutes: { format: ['HH:mm a Z', ':mm'] },
              },
            },
          },
        };

        const chart = new google.visualization.CandlestickChart(
          document.getElementById('trades_chart'));
        chart.draw(data, options);
      }
    }
  };

  self.ejs = function ejs(urlIn, element, data) {
    if ($(`#${element}`).length) {
      const url = `${window.location.origin}/templates/${urlIn}`;
      new EJS({ url }).update(element, data);
    } else {
      console.log(`Failed to render template because ${element} does not exist.`);
    }
  };
}

const tradeUtil = new TradeUtil();

module.exports = { TradeUtil: tradeUtil };
