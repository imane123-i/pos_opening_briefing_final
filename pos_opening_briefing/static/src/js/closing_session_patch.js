/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { OpeningBriefingPopup } from "./opening_briefing_popup";
import { PosStore } from "@point_of_sale/app/store/pos_store";

patch(PosStore.prototype, {
    async closeSession() {
        // PosStore a accès aux services via this.env.services
        const popup = this.env.services.popup;

        if (!popup) {
            // Fallback : si le service n'est pas disponible, fermeture directe
            return await super.closeSession(...arguments);
        }

        const { confirmed } = await popup.add(OpeningBriefingPopup, {
            title: "Checklist Fermeture",
            mode: "closing",
        });

        if (confirmed) {
            return await super.closeSession(...arguments);
        }
        // Sinon on annule la fermeture
    }
});