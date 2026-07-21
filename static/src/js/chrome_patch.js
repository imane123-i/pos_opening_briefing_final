/** @odoo-module **/

import { Chrome } from "@point_of_sale/app/pos_app";
import { patch } from "@web/core/utils/patch";
import { OpeningBriefingPopup } from "./opening_briefing_popup";
import { useService } from "@web/core/utils/hooks";
import { onMounted } from "@odoo/owl";

// ✅ Patch ouverture : formulaire obligatoire si opening_checklist_done est false
patch(Chrome.prototype, {
    setup() {
        super.setup(...arguments);
        const popup = useService("popup");
        onMounted(() => {
            const session = this.pos.pos_session || this.pos.session;

            console.log("🔍 Chrome.setup - Vérification session:");
            console.log("   session.id:", session ? session.id : "N/A");
            console.log("   opening_checklist_done:", session ? session.opening_checklist_done : "N/A");

            // Affiche SEULEMENT SI :
            // 1. Le formulaire n'a pas été rempli pour cette session (opening_checklist_done === false)
            // 2. ET le popup n'a pas déjà été lancé dans ce cycle de rendu runtime
            if (session && !session.opening_checklist_done && !this.pos._opening_popup_shown) {
                console.log("✅ Checklist vide → AFFICHAGE du formulaire ouverture");
                this.pos._opening_popup_shown = true;
                popup.add(OpeningBriefingPopup, {
                    title: "Checklist Ouverture",
                    mode: "opening",
                });
            } else {
                console.log("❌ PAS d'affichage ouverture");
                if (this.pos._opening_popup_shown) console.log("   Raison: Popup déjà ouvert dans ce cycle runtime");
                if (session && session.opening_checklist_done) console.log("   Raison: opening_checklist_done = true");
            }
        });
    }
});

// NOTE: Le patch de FERMETURE se trouve dans closing_session_patch.js
// (patch de PosStore.closeSession). Un seul point d'interception évite
// le double déclenchement qui provoque l'erreur "Erreur à la fermeture de la session".