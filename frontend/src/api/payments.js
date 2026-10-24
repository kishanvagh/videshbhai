import api from './client';

export const getPayments = (params) => api.get('/payments', { params });
export const createPayment = (data) => api.post('/payments', data);
export const getPayment = (id) => api.get(`/payments/${id}`);
export const reversePayment = (id, data) => api.post(`/payments/${id}/reverse`, data);
export const getOutstandingByParty = (partyId) => api.get(`/payments/outstanding/${partyId}`);

/**
 * Normalizes the /payments/outstanding/:partyId response into a flat invoice
 * shape that the form/modal UI can render directly.
 *
 * The API returns items like { sale: { id, invoiceNumber, saleDate, productName,
 * foreignCurrency, saleAmountForeign }, outstanding: { outstandingINR,
 * outstandingForeign, ... } }. This flattens each item to:
 *   { _id, invoiceNumber, saleDate, productName, currency, outstanding }
 * where `outstanding` is the amount in the invoice's own currency.
 *
 * @param {*} raw - response data array
 * @param {string} [currency] - optional currency to filter invoices by
 * @returns {Array<{_id: string, invoiceNumber: string, saleDate: string, productName: string, currency: string, outstanding: number}>}
 */
export const flattenOutstandingInvoices = (raw, currency) => {
  const list = Array.isArray(raw) ? raw : [];
  return list
    .map((inv) => {
      const sale = inv?.sale && typeof inv.sale === 'object' ? inv.sale : inv || {};
      const out = inv?.outstanding && typeof inv.outstanding === 'object' ? inv.outstanding : {};
      const id = sale.id || sale._id || inv?._id || inv?.id;
      const invCurrency = sale.foreignCurrency || inv?.currency || '';
      const isForeign = invCurrency && invCurrency !== 'INR' && parseFloat(sale.saleAmountForeign || 0) > 0;
      const outstanding = parseFloat(
        isForeign
          ? (out.outstandingForeign ?? out.outstanding ?? 0)
          : (out.outstandingINR ?? out.outstanding ?? 0)
      ) || 0;
      return {
        _id: id,
        id,
        invoiceNumber: sale.invoiceNumber || inv?.invoiceNumber || out.invoiceNumber || '',
        saleDate: sale.saleDate || inv?.saleDate,
        productName: sale.productName || inv?.productName || 'Jewelry',
        currency: invCurrency || 'INR',
        outstanding,
      };
    })
    .filter((inv) => inv._id && inv.outstanding > 0)
    .filter((inv) => !currency || inv.currency === currency);
};
