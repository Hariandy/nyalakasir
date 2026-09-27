/* 99-start.js — runs last so every module (sheets, actions) is defined before boot continues. */
window.NYALA_TEST = { state: () => state, normQtyInput, printTx, computeTotals, productHpp, productHppR, toScaled, rRound, itemCostR, suggestPrice, quickCash, pctToBp, bpApply, checkout, voidTx, summarize, loadReport, verifyLicenseKey, migrateLegacy, validateBackup, buildBackup, sanitizeCatalog, fmtStock, portionsLeft, addToCart, DB, refreshPlan, rp,
  lineChoices, stampEarned, computeInsights: (...a) => computeInsights(...a), shiftSummary: (...a) => shiftSummary(...a), netReport: (...a) => netReport(...a), stockForecast: (...a) => stockForecast(...a), SYNC };
boot().catch(e => { console.error(e); showFatal(e); });
