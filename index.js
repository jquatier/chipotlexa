const Alexa = require('alexa-sdk');
const ChipsAndGuac = require('chipsandguac');

var states = {
  LAUNCH: '_LAUNCH',
  START_ORDER: '_START_ORDER'
}

const handlers = {
  'LaunchRequest': function() {
    this.handler.state = states.LAUNCH;
    this.emitWithState('Launch', true);
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
    this.attributes['orderIndex'] = 0;
    this.handler.state = states.START_ORDER;
    this.emit(':tell', 'Great!');
    // look up orders, etc
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

exports.handler = (event, context, callback) => {
  const alexa = Alexa.handler(event, context);
  alexa.registerHandlers(handlers, launchHandlers);
  alexa.execute();
};
