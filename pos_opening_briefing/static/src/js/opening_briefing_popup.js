/** @odoo-module **/
import { AbstractAwaitablePopup } from "@point_of_sale/app/popup/abstract_awaitable_popup";
import { _t } from "@web/core/l10n/translation";
import { useState } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { usePos } from "@point_of_sale/app/store/pos_hook";

export class OpeningBriefingPopup extends AbstractAwaitablePopup {
    static template = "pos_opening_briefing.OpeningBriefingPopup";

    setup() {
        super.setup();
        this.pos = usePos();
        this.orm = useService("orm");
        this.notification = useService("notification");
        let allProducts = [];
        try {
            if (this.pos.db && this.pos.db.get_product_by_category) {
                allProducts = this.pos.db.get_product_by_category(0) || [];
            }
        } catch (e) { console.warn("Could not load products:", e); }
        this.products = allProducts.sort((a, b) => (a.display_name || "").localeCompare(b.display_name || ""));
        const t = this._getCurrentTime();
        
        const s = this.pos.pos_session || this.pos.session;
        this.isClosingMode = s && s.opening_checklist_done;

        this.state = useState({
            isClosingMode: this.isClosingMode,
            currentStep: this.isClosingMode ? 2 : 1, isSaving: false,
            opening_hour: t, 
            floor_clean: false, windows_clean: false, shelves_clean: false, opening_clean_rem: "",
            lights_ok: false, radio_ok: false, aircon_ok: false, opening_ambiance_rem: "",
            bestsellers: false, tidy: false, sizes: false, opening_merch_rem: "",
            cash_open: false, cash_float: 0, tpe_ok: false, opening_cash_rem: "",
            staff_full: false, staff_outfit: false, brief_done: false, opening_staff_rem: "",
            opening_photo: null,
            
            c_hour: t, 
            c_cash_closed_check: false, c_cash_total: 0, c_tpe_total: 0,
            c_compliant: "no", c_gap: "", closing_cash_rem: "",
            c_stock_out: "", c_stock_anomalies: "", closing_stock_rem: "",
            c_clean: false, c_tidy: false, closing_clean_rem: "",
            c_lights_off: false, c_locked: false, closing_sec_rem: "",
            closing_photo: null,
            
            p_ca: 0, p_tickets: 0, p_basket: 0, p_best_id: null, p_slow_id: null,
            rem_prob: "", rem_needs: "", recipient_email: "",
        });

        // ✅ Fetch last closed session time for the current POS
        if (this.pos.config && this.pos.config.id) {
            this.orm.searchRead(
                "pos.session", 
                [["config_id", "=", this.pos.config.id], ["state", "=", "closed"]], 
                ["stop_at"], 
                { limit: 1, order: "stop_at desc" }
            ).then((sessions) => {
                if (sessions.length > 0 && sessions[0].stop_at) {
                    // stop_at is in UTC, add 'Z' to parse correctly
                    let dt = new Date(sessions[0].stop_at + "Z");
                    if (!isNaN(dt.getTime())) {
                        this.state.c_hour = dt.getHours().toString().padStart(2, "0") + ":" + dt.getMinutes().toString().padStart(2, "0");
                    }
                }
            }).catch(() => {});
        }
    }

    // --- Prevent closing without validation ---
    cancel() {
        // Do nothing to prevent escaping
        this.notification.add(_t("La checklist est obligatoire avant de continuer."), { type: "warning" });
    }

    _getCurrentTime() {
        const n = new Date();
        return n.getHours().toString().padStart(2,"0") + ":" + n.getMinutes().toString().padStart(2,"0");
    }
    getProductList() { return this.products; }

    async resizeImage(base64Str, maxW = 800, maxH = 800) {
        return new Promise((resolve) => {
            const img = new Image();
            img.src = "data:image/jpeg;base64," + base64Str;
            img.onload = () => {
                const c = document.createElement("canvas");
                let w = img.width, h = img.height;
                if (w > h) { if (w > maxW) { h *= maxW / w; w = maxW; } }
                else { if (h > maxH) { w *= maxH / h; h = maxH; } }
                c.width = w; c.height = h;
                c.getContext("2d").drawImage(img, 0, 0, w, h);
                resolve(c.toDataURL("image/jpeg", 0.6).split(",")[1]);
            };
        });
    }

    async onPhotoUpload(ev, field) {
        const file = ev.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (e) => {
            this.state[field] = await this.resizeImage(e.target.result.split(",")[1]);
        };
        reader.readAsDataURL(file);
    }

    isStepValid() {
        const s = this.state;
        if (!s.isClosingMode) {
            if (s.currentStep === 1) return !!(s.opening_hour && s.opening_photo);
            return true;
        } else {
            if (s.currentStep === 2) return !!(s.c_hour && s.closing_photo);
            if (s.currentStep === 3) return !!(s.p_ca > 0 && s.p_tickets > 0);
            return true;
        }
    }
    nextStep() {
        if (this.isStepValid()) this.state.currentStep++;
        else alert(_t("Veuillez remplir les champs obligatoires (Photo, CA, Tickets) avant de continuer."));
    }
    prevStep() { 
        if (this.state.currentStep > (this.state.isClosingMode ? 2 : 1)) {
            this.state.currentStep--; 
        }
    }



    async confirm() {
        if (this.state.isSaving) return;
        this.state.isSaving = true;
        try {
            const sid = this.pos.pos_session ? this.pos.pos_session.id : false;
            if (!sid) { alert(_t("Aucune session POS active.")); return; }
            const s = this.state;
            
            let vals = { is_closing: s.isClosingMode };
            
            if (!s.isClosingMode) {
                vals = {
                    ...vals,
                    opening_hour: s.opening_hour, 
                    opening_floor_clean: s.floor_clean,
                    opening_windows_clean: s.windows_clean, 
                    opening_shelves_clean: s.shelves_clean,
                    opening_lights_ok: s.lights_ok,
                    opening_radio_ok: s.radio_ok, 
                    opening_aircon_ok: s.aircon_ok,
                    opening_bestsellers_ok: s.bestsellers,
                    opening_tidy_products: s.tidy, 
                    opening_sizes_present: s.sizes,
                    opening_cash_open: s.cash_open,
                    opening_cash_float: parseFloat(s.cash_float) || 0, 
                    opening_tpe_ok: s.tpe_ok,
                    opening_staff_full: s.staff_full,
                    opening_staff_outfit: s.staff_outfit, 
                    opening_briefing_done: s.brief_done,
                    opening_photo: s.opening_photo,
                    opening_clean_rem: s.opening_clean_rem,
                    opening_ambiance_rem: s.opening_ambiance_rem,
                    opening_merch_rem: s.opening_merch_rem,
                    opening_cash_rem: s.opening_cash_rem,
                    opening_staff_rem: s.opening_staff_rem,
                };
            } else {
                vals = {
                    ...vals,
                    closing_hour_manual: s.c_hour, 
                    closing_cash_closed: s.c_cash_closed_check,
                    closing_cash_total: parseFloat(s.c_cash_total) || 0,
                    closing_tpe_total: parseFloat(s.c_tpe_total) || 0,
                    closing_cash_compliant: s.c_compliant, 
                    closing_cash_gap: s.c_gap,
                    closing_stock_out: s.c_stock_out, 
                    closing_stock_anomalies: s.c_stock_anomalies,
                    closing_shop_clean: s.c_clean, 
                    closing_products_tidy: s.c_tidy,
                    closing_lights_off: s.c_lights_off,
                    closing_door_locked: s.c_locked, 
                    closing_photo: s.closing_photo,
                    perf_ca_total: parseFloat(s.p_ca) || 0, 
                    perf_tickets_count: parseInt(s.p_tickets) || 0,
                    perf_avg_basket: parseFloat(s.p_basket) || 0,
                    perf_best_seller: s.p_best_id ? parseInt(s.p_best_id) : false,
                    perf_slow_seller: s.p_slow_id ? parseInt(s.p_slow_id) : false,
                    rem_problems: s.rem_prob, 
                    rem_needs: s.rem_needs,
                    closing_cash_rem: s.closing_cash_rem,
                    closing_stock_rem: s.closing_stock_rem,
                    closing_clean_rem: s.closing_clean_rem,
                    closing_sec_rem: s.closing_sec_rem,
                    recipient_email: s.recipient_email, 
                };
            }

            const result = await this.orm.call("pos.session", "action_save_checklist", [sid, vals]);
            if (result && result.success) {
                if (!s.isClosingMode) {
                    this.notification.add(_t("Ouverture enregistrée avec succès !"), { type: "success" });
                    const session = this.pos.pos_session || this.pos.session;
                    session.opening_checklist_done = true; // Update local state
                } else {
                    this.notification.add(_t("Checklist de fermeture enregistrée et envoyée !"), { type: "success" });
                    const session = this.pos.pos_session || this.pos.session;
                    session.closing_checklist_done = true;
                }
                
                super.confirm();
            } else {
                const errMsg = result && result.error ? result.error : _t("Erreur inconnue");
                alert(_t("Erreur: ") + errMsg);
            }
        } catch (error) {
            console.error("RPC Error:", error);
            const detail = error.message || error.data?.message || "";
            alert(_t("Erreur de communication avec le serveur: ") + detail);
        } finally { this.state.isSaving = false; }
    }
}
OpeningBriefingPopup.template = "pos_opening_briefing.OpeningBriefingPopup";
