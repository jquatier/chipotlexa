const Alexa = require('alexa-sdk');
const ChipsAndGuac = require('chipsandguac');
const profile = require('./profile.json');

const states = {
  LAUNCH: '_LAUNCH',
  LIST_ORDERS: '_LIST_ORDERS',
  CONFIRM_ORDER: '_CONFIRM_ORDER'
};

function getChipsAndGuac(attributes) {
  if (attributes.cag) {
    return attributes.cag;
  }
  console.log('creating new CaG', profile);
  attributes.cag = new ChipsAndGuac(profile);
  return attributes.cag;
}

function getCachedOrders(attributes) {
  if (attributes.ordersCache) {
    return Promise.resolve(attributes.ordersCache);
  } else {
    console.log('fetching orders');
    return getChipsAndGuac(attributes).getOrders();
  }
}

function buildOrderDetailsResponse(order) {
  var response = '';
  order.items.forEach(function(item, index) {
    if (index > 0) {
      response += ', and, ';
    }
    response += item.name.replace(' x ', ' ');
    if (item.details) {
      response += ' with ' + item.details;
    }
  });
  return response;
}

const handlers = {
  'LaunchRequest': function() {
    console.log('launch request');
    this.handler.state = states.LAUNCH;
    this.emitWithState('Launch', true);
  },

  'PlaceOrderIntent': function() {
    console.log('place order request');
    this.attributes.orderIndex = 0;
    this.handler.state = states.LIST_ORDERS;
    this.emitWithState('ListOrders', true);
  }
};

const launchHandlers = Alexa.CreateStateHandler(states.LAUNCH, {
  'Launch': function() {
    this.emit(':ask', 'Chipotle. Would you like to place an order?',
      'Say yes to place an order, or no to exit.');
  },

  'AMAZON.HelpIntent': function() {
    const message = 'Would you like to place a Chipotle order?';
    this.emit(':ask', message, message);
  },

  'AMAZON.YesIntent': function() {
    this.attributes.orderIndex = 0;
    this.handler.state = states.LIST_ORDERS;
    this.emitWithState('ListOrders', true);
  },

  'AMAZON.NoIntent': function() {
    this.emit(':tell', 'Ok, goodbye.');
  },

  'SessionEndedRequest': function() {
    console.log('session ended.');
  },

  'Unhandled': function() {
    const message = 'Say yes to place an order, or no to exit.';
    this.emit(':ask', message, message);
  }
});

const ordersHandlers = Alexa.CreateStateHandler(states.LIST_ORDERS, {
  'ListOrders': function() {
    console.log('listing orders', this.attributes.orderIndex);
    getCachedOrders(this.attributes).then((orders) => {
      console.log(orders);
      this.attributes.ordersCache = orders;
      const orderDetails = buildOrderDetailsResponse(orders[this.attributes.orderIndex]);
      var message = (this.attributes.orderIndex === 0) ?
        `last time you got ${orderDetails}.` : `another order you placed was ${orderDetails}.`;
      message += ' Would you like to order this again?';
      this.emit(':ask', 'Ok, ' + message, message);
    }).catch((error) => {
      console.log(error);
      this.emitWithState('Error', true);
    });
  },

  'AMAZON.YesIntent': function() {
    this.handler.state = states.CONFIRM_ORDER;
    this.emitWithState('Confirm', true);
  },

  'AMAZON.NoIntent': function() {
    this.attributes.orderIndex++;
    this.emitWithState('ListOrders', true);
  },

  'Unhandled': function() {
    const message = 'Say yes to place this order, or no to choose a different order.';
    this.emit(':ask', message, message);
  }
});

const confirmHandlers = Alexa.CreateStateHandler(states.CONFIRM_ORDER, {
  'Confirm': function() {
    // add place order logic
    this.emit(':tell', this.attributes.orderIndex);
  }
});

exports.handler = (event, context, callback) => {
  const alexa = Alexa.handler(event, context);
  alexa.registerHandlers(handlers, launchHandlers, ordersHandlers, confirmHandlers);
  alexa.execute();
};
