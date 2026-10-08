import { Linking } from 'react-native';

export const WHATSAPP_NUMBER = '263785823025';
export const WHATSAPP_DISPLAY = '0785 823 025';

/**
 * Opens a WhatsApp chat with the shop, pre-filled with `message`.
 * wa.me hands off to the WhatsApp app when installed, otherwise opens WhatsApp Web.
 */
export const openWhatsApp = async (message = "Hi LoveNest! I'd like to place an order / make an enquiry.") => {
  const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
};
