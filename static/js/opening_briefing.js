/** @odoo-module **/

import { Component, useState, onMounted } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { patch } from "@web/core/utils/patch";
import { ProductScreen } from "@point_of_sale/app/screens/product_screen/product_screen";

export class OpeningBriefingPopup extends Component {
    static template = "pos_opening_briefing.OpeningBriefingPopup";

    setup() {
        this.orm = useService("orm");
        this.pos = useService("pos");
        this.dialog = useService("dialog");
        
        this.state = useState({
            currentStep: 1,
            // PARTIE 1
            opening_hour: "",
            opening_floor_clean: false,
            opening_windows_clean: false,
            opening_shelves_clean: false,
            opening_lights_ok: false,
            opening_radio_ok: false,
            opening_aircon_ok: false,
            opening_bestsellers_ok: false,
            opening_tidy_products: false,
            opening_sizes_present: false,
            opening_cash_open: false,
            opening_cash_float_check: false,
            opening_cash_float: 0,
            opening_tpe_ok: false,
            opening_staff_full: false,
            opening_staff_outfit: false,
            opening_briefing_done: false,
            opening_photo: null,
            
            // PARTIE 2
            closing_hour_manual: "",
            closing_cash_closed: false,
            closing_cash_total: 0,
            closing_tpe_total: false,
            closing_tpe_total_amount: 0,
            closing_cash_compliant: "yes",
            closing_cash_gap: "",
            closing_stock_out: "",
            closing_stock_anomalies: "",
            closing_shop_clean: false,
            closing_products_tidy: false,
            closing_lights_off: false,
            closing_door_locked: false,
            closing_photo: null,
            
            // PARTIE 3
            perf_ca_total: 0,
            perf_tickets_count: 0,
            perf_avg_basket: 0,
            perf_best_seller: "",
            perf_slow_seller: "",
            
            // PARTIE 4
            rem_problems: "",
            rem_needs: "",
            recipient_email: "",
            isSaving: false,
            errorMessage: ""
        });

        onMounted(() => {
            console.log("Popup ouvert");
        });
    }

    onPhotoUpload(ev, field) {
        const file = ev.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const base64 = e.target.result.split(',')[1];
                this.state[field] = base64;
            };
            reader.readAsDataURL(file);
        }
    }

    isStep1Valid() {
        return this.state.opening_hour && 
               this.state.opening_photo &&
               (this.state.opening_floor_clean || this.state.opening_windows_clean || this.state.opening_shelves_clean) &&
               (this.state.opening_lights_ok || this.state.opening_radio_ok || this.state.opening_aircon_ok);
    }

    isStep2Valid() {
        return this.state.closing_hour_manual &&
               this.state.closing_photo &&
               this.state.closing_cash_compliant;
    }

    isStep3Valid() {
        return this.state.perf_ca_total > 0 &&
               this.state.perf_tickets_count > 0 &&
               this.state.perf_best_seller &&
               this.state.perf_slow_seller;
    }

    isStep4Valid() {
        return true;
    }

    nextStep() {
        if (this.state.currentStep === 1 && !this.isStep1Valid()) {
            this.state.errorMessage = "Veuillez remplir tous les champs obligatoires de l'ouverture";
            return;
        }
        if (this.state.currentStep === 2 && !this.isStep2Valid()) {
            this.state.errorMessage = "Veuillez remplir tous les champs obligatoires de la fermeture";
            return;
        }
        if (this.state.currentStep === 3 && !this.isStep3Valid()) {
            this.state.errorMessage = "Veuillez remplir tous les champs obligatoires de la performance";
            return;
        }

        this.state.errorMessage = "";
        if (this.state.currentStep < 4) {
            this.state.currentStep++;
        }
    }

    prevStep() {
        this.state.errorMessage = "";
        if (this.state.currentStep > 1) {
            this.state.currentStep--;
        }
    }

    async confirm() {
        if (this.state.isSaving) return;
        this.state.isSaving = true;
        this.state.errorMessage = "";

        try {
            const vals = {
                briefing_checklist_done: true,
                opening_hour: this.state.opening_hour,
                opening_floor_clean: this.state.opening_floor_clean,
                opening_windows_clean: this.state.opening_windows_clean,
                opening_shelves_clean: this.state.opening_shelves_clean,
                opening_lights_ok: this.state.opening_lights_ok,
                opening_radio_ok: this.state.opening_radio_ok,
                opening_aircon_ok: this.state.opening_aircon_ok,
                opening_bestsellers_ok: this.state.opening_bestsellers_ok,
                opening_tidy_products: this.state.opening_tidy_products,
                opening_sizes_present: this.state.opening_sizes_present,
                opening_cash_open: this.state.opening_cash_open,
                opening_cash_float_check: this.state.opening_cash_float_check,
                opening_cash_float: parseFloat(this.state.opening_cash_float) || 0,
                opening_tpe_ok: this.state.opening_tpe_ok,
                opening_staff_full: this.state.opening_staff_full,
                opening_staff_outfit: this.state.opening_staff_outfit,
                opening_briefing_done: this.state.opening_briefing_done,
                opening_photo: this.state.opening_photo,
                
                closing_hour_manual: this.state.closing_hour_manual,
                closing_cash_closed: this.state.closing_cash_closed,
                closing_cash_total: parseFloat(this.state.closing_cash_total) || 0,
                closing_tpe_total: this.state.closing_tpe_total,
                closing_tpe_total_amount: parseFloat(this.state.closing_tpe_total_amount) || 0,
                closing_cash_compliant: (this.state.closing_cash_gap === "" || parseFloat(this.state.closing_cash_gap) === 0) ? "yes" : "no",
                closing_cash_gap: this.state.closing_cash_gap,
                closing_stock_out: this.state.closing_stock_out,
                closing_stock_anomalies: this.state.closing_stock_anomalies,
                closing_shop_clean: this.state.closing_shop_clean,
                closing_products_tidy: this.state.closing_products_tidy,
                closing_lights_off: this.state.closing_lights_off,
                closing_door_locked: this.state.closing_door_locked,
                closing_photo: this.state.closing_photo,
                
                perf_ca_total: parseFloat(this.state.perf_ca_total) || 0,
                perf_tickets_count: parseInt(this.state.perf_tickets_count) || 0,
                perf_avg_basket: parseFloat(this.state.perf_avg_basket) || 0,
                perf_best_seller: this.state.perf_best_seller,
                perf_slow_seller: this.state.perf_slow_seller,
                
                rem_problems: this.state.rem_problems,
                rem_needs: this.state.rem_needs,
                recipient_email: this.state.recipient_email,
            };

            const result = await this.orm.call("pos.session", "action_save_checklist", [this.pos.session.id, vals]);

            if (result && result.error) {
                this.state.errorMessage = result.error;
                this.state.isSaving = false;
                return;
            }

            alert("Checklist completee! Email envoye.");
            window.location.reload();

        } catch (e) {
            this.state.isSaving = false;
            console.error("Erreur:", e);
            this.state.errorMessage = "Erreur: " + (e.message || JSON.stringify(e));
        }
    }
}

patch(ProductScreen.prototype, {
    setup() {
        super.setup(...arguments);
        this.orm = useService("orm");
        this.dialog = useService("dialog");
        
        // ✅ APPELLE LA VÉRIFICATION AU CHARGEMENT
        onMounted(async () => {
            console.log("ProductScreen monté - Vérification du formulaire...");
            await this._checkBriefing();
        });
    },

    async _checkBriefing() {
        try {
            console.log("Vérification formulaire d'ouverture...");
            console.log("État session actuel:", this.pos.session);
            
            // ✅ RÉCUPÈRE DIRECTEMENT DEPUIS LA SESSION CHARGÉE
            const session = this.pos.session;
            const sessionState = session && session.state;
            const briefingDone = session && session.opening_checklist_done;

            console.log(`Session state: ${sessionState}, briefing done: ${briefingDone}`);

            // ✅ AFFICHE LE FORMULAIRE SEULEMENT SI :
            // 1. C'est une NOUVELLE session (state == 'new_session')
            // 2. ET le formulaire n'a pas été rempli (opening_checklist_done == false)
            if (sessionState === 'new_session' && !briefingDone) {
                console.log("✅ Nouvelle session + checklist non remplie → Affichage du formulaire");
                this.dialog.add(OpeningBriefingPopup, {});
            } else {
                console.log(`❌ Pas d'affichage - State: ${sessionState}, Briefing done: ${briefingDone}`);
            }
        } catch (e) {
            console.error("Erreur check briefing:", e);
        }
    }
});