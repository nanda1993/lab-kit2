// in-app inbox shown in the Kestrel app
const inboxes = new Map();

export default {
  name: 'inapp',

  validate(message) {
    if (!/^CUST-\d{6}$/.test(message.to)) {
      throw new Error('invalid customer id for inapp: ' + message.to);
    }
  },

  async send(message, deps) {
    const list = inboxes.get(message.to) || [];
    list.unshift({ title: message.subject, body: message.body, at: Date.now() });
    if (list.length > 50) list.length = 50;
    inboxes.set(message.to, list);
    console.log('inapp notification stored for ' + message.to);
    return { providerRef: 'inapp_' + list.length };
  },

  inbox(customerId) {
    return inboxes.get(customerId) || [];
  },
};
