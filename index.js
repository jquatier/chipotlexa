const Alexa = require('alexa-sdk');
const ChipsAndGuac = require('chipsandguac');
const profile = require('./profile.json');

const states = {
  LAUNCH: '_LAUNCH',
  LIST_ORDERS: '_LIST_ORDERS',
  PLACE_ORDER: '_PLACE_ORDER'
};

var cag = undefined;

function getChipsAndGuac(attributes) {
  return cag || new ChipsAndGuac(profile);
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
    response += item.name.replace(' x ', ' ')
      .replace(' & ', ' and ')
      .replace(/\s*\(.*?\)\s*/g, '');
    if (item.details) {
      response += ' with ' + item.details;
    }
  });
  console.log(response);
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
      this.attributes.selectedOrderId = orders[this.attributes.orderIndex].id;
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
    this.handler.state = states.PLACE_ORDER;
    this.emitWithState('Review', true);
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

const placeOrderHandlers = Alexa.CreateStateHandler(states.PLACE_ORDER, {
  'Review': function() {
    console.log('review', this.attributes.selectedOrderId);
    const cag = getChipsAndGuac(this.attributes);
    cag.submitPreviousOrderWithId(this.attributes.selectedOrderId, true).then((orderDetails) => {
      const message = `Your order will be ready on ${orderDetails.pickupTimes[0]}` +
        '. To place this order, please say confirm.';
      this.emit(':ask', 'Ok, ' + message, message);
    }).catch((e) => {
      console.log(e);
      if(e.message.indexOf('closed') > 0) {
        this.emit(':tell', 'Sorry, it looks like Chipotle is currently closed, try again later.');
      } else {
        this.emitWithState('Error', true);
      }
    });
  },

  'ConfirmIntent': function() {
    console.log('confirm', this.attributes.selectedOrderId);
    const cag = getChipsAndGuac(this.attributes);
    cag.submitPreviousOrderWithId(this.attributes.selectedOrderId, profile.previewMode || false).then((orderDetails) => {
      var message;
      if(profile.previewMode) {
        message = `Preview mode is enabled. Your order would have been ready on ${orderDetails.pickupTimes[0]}` +
          ` at the location on ${orderDetails.location}` +
          '. If everything worked, you can disable preview mode for next time to place a real order.';
      } else {
        message = `Ok, Your order will be ready on ${orderDetails.pickupTime}` +
          ` at the location on ${orderDetails.location}. Enjoy your meal!`;
      }
      this.emit(':tell', message);
    }).catch((e) => {
      console.log(e);
      if(e.message.indexOf('closed') > 0) {
        this.emit(':tell', 'Sorry, it looks like Chipotle is currently closed, try again later.');
      } else {
        this.emitWithState('Error', true);
      }
    });
  },

  'Unhandled': function() {
    const message = 'Say confirm to place this order, or exit to cancel this order.';
    this.emit(':ask', message, message);
  }
});

exports.handler = (event, context, callback) => {
  const alexa = Alexa.handler(event, context);
  alexa.registerHandlers(handlers, launchHandlers, ordersHandlers, placeOrderHandlers);
  alexa.execute();
};
