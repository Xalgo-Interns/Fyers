// orders/orders.js
const client = require("../auth/auth");

/**
 * Places a new order
 * @param {Object} order - Order details (e.g., { symbol: 'NSE:TATAMOTORS-EQ', quantity: 10, type: 'BUY' })
 * @returns {Promise<Object>} - Order placement result
 */
async function placeOrder(order) {
  try {
    const result = await client.placeOrder(order);
    return result;
  } catch (error) {
    console.error("Error placing order:", error);
    throw error;
  }
}

/**
 * Modifies an existing order
 * @param {string} orderId - The ID of the order to modify
 * @param {Object} modifications - Modifications to apply (e.g., { quantity: 5 })
 * @returns {Promise<Object>} - Order modification result
 */
async function modifyOrder(orderId, modifications) {
  try {
    const result = await client.modifyOrder(orderId, modifications);
    return result;
  } catch (error) {
    console.error("Error modifying order:", error);
    throw error;
  }
}

/**
 * Cancels an existing order
 * @param {string} orderId - The ID of the order to cancel
 * @returns {Promise<Object>} - Order cancellation result
 */
async function cancelOrder(orderId) {
  try {
    const result = await client.cancelOrder(orderId);
    return result;
  } catch (error) {
    console.error("Error canceling order:", error);
    throw error;
  }
}

module.exports = { placeOrder, modifyOrder, cancelOrder };
