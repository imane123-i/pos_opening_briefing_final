/** @odoo-module **/

import { Chrome } from "@point_of_sale/app/pos_app";
import { patch } from "@web/core/utils/patch";
import { OpeningBriefingPopup } from "./opening_briefing_popup";
import { ClosePosPopup } from "@point_of_sale/app/navbar/closing_popup/closing_popup";
import { useService } from "@web/core/utils/hooks";
import { onMounted } from "@odoo/owl";

// Patch 1 : formulaire ouverture au démarrage UNIQUEMENT (pas sur "continuer la vente")
patch(Chrome.prototype, {
    setup() {
        super.setup(...arguments);
        const popup = useService("popup");
        onMounted(() => {
            const session = this.pos.pos_session || this.pos.session;
            // N'affiche le popup que si :
            // 1. La session vient d'être créée (pas de checklist ouverture faite)
            // 2. Le popup n'a pas déjà été affiché dans cette instance
            // 3. La session est dans l'état "opening_control" ou équivalent (nouvelle ouverture)
            if (session && !session.opening_checklist_done && !window._openingPopupShown) {
                // Vérifie que c'est bien une nouvelle ouverture (état ouverture, pas reprise)
                const isNewSession = !session._alreadyStarted;
                if (isNewSession) {
                    window._openingPopupShown = true;
                    session._alreadyStarted = true;
                    popup.add(OpeningBriefingPopup, {
                        title: "Checklist Ouverture",
                        mode: "opening",
                    });
                }
            }
        });
    }
});

// Patch 2 : intercepter le bouton Close Session
patch(ClosePosPopup.prototype, {
    async confirm() {
        console.log("✅ ClosePosPopup.confirm intercepté");
        const popup = this.env.services.popup;
        const { confirmed } = await popup.add(OpeningBriefingPopup, {
            title: "Checklist Fermeture",
            mode: "closing",
        });
        if (confirmed) {
            return await super.confirm(...arguments);
        }
    }
});
