/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { OpeningBriefingPopup } from "./opening_briefing_popup";
import { ClosePosPopup } from "@point_of_sale/app/navbar/closing_popup/closing_popup";

// ✅ Interception de la FERMETURE via ClosePosPopup.confirm()
// Cette approche est plus fiable car ClosePosPopup est un composant OWL
// qui a accès aux services (popup) via this.env.services directement.
// PosStore.closeSession() ne peut pas accéder correctement au service popup.
patch(ClosePosPopup.prototype, {
    async confirm() {
        console.log("✅ ClosePosPopup.confirm() intercepté → Affichage checklist fermeture");
        
        const popup = this.env.services.popup;
        if (!popup) {
            console.warn("⚠️ Service popup non disponible, fermeture directe");
            return await super.confirm(...arguments);
        }

        try {
            const { confirmed } = await popup.add(OpeningBriefingPopup, {
                title: "Checklist Fermeture",
                mode: "closing",
            });

            if (confirmed) {
                console.log("✅ Checklist fermeture validée → fermeture session");
                return await super.confirm(...arguments);
            } else {
                console.log("❌ Checklist fermeture annulée → fermeture session annulée");
                // Ne pas appeler super.confirm() = annuler la fermeture
            }
        } catch (e) {
            console.error("❌ Erreur lors de l'affichage de la checklist fermeture:", e);
            // En cas d'erreur du popup, on ferme quand même normalement
            return await super.confirm(...arguments);
        }
    }
});