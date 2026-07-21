/** @odoo-module **/
import { AbstractAwaitablePopup } from "@point_of_sale/app/popup/abstract_awaitable_popup";
import { _t } from "@web/core/l10n/translation";
import { useState, onMounted } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { usePos } from "@point_of_sale/app/store/pos_hook";

export class OpeningBriefingPopup extends AbstractAwaitablePopup {
    static template = "pos_opening_briefing.OpeningBriefingPopup";

    setup() {
        super.setup();
        this.pos = usePos();
        this.orm = useService("orm");
        this.notification = useService("notification");
        onMounted(() => {
            if (this.el) {
                const dialogEl = this.el.closest(".o_dialog") || this.el.closest(".modal-dialog") || this.el.closest(".modal-content");
                if (dialogEl) {
                    dialogEl.classList.add("briefing-popup-dialog");
                    const parentDialog = dialogEl.closest(".o_dialog");
                    if (parentDialog) {
                        parentDialog.classList.add("briefing-popup-dialog");
                    }
                }
            }
        });
        let allProducts = [];
        try {
            if (this.pos.db && this.pos.db.product_by_id) {
                allProducts = Object.values(this.pos.db.product_by_id);
            } else if (this.pos.db && this.pos.db.get_product_by_category) {
                allProducts = this.pos.db.get_product_by_category(0) || [];
            }
        } catch (e) { console.warn("Could not load products:", e); }
        this.products = allProducts.sort((a, b) => (a.display_name || "").localeCompare(b.display_name || ""));
        const t = this._getCurrentTime();
        
        const s = this.pos.pos_session || this.pos.session;
        
        // ✅ NOUVEAU : Lis la prop 'mode' si elle existe (sinon fallback sur opening_checklist_done)
        const propMode = this.props && this.props.mode;
        if (propMode === 'closing') {
            this.isClosingMode = true;
            console.log("✅ Mode FERMETURE (passé en prop)");
        } else if (propMode === 'opening') {
            this.isClosingMode = false;
            console.log("✅ Mode OUVERTURE (passé en prop)");
        } else {
            // Fallback : basé sur l'état de la session
            this.isClosingMode = s && s.opening_checklist_done;
            console.log("⚠️ Mode déterminé par opening_checklist_done:", this.isClosingMode);
        }

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
            
            p_ca: 0, p_tickets: 0, p_basket: 0,
            p_best_ids: s.perf_best_seller_ids || [],
            p_slow_ids: s.perf_slow_seller_ids || [],
            c_stock_out_ids: s.closing_stock_out_ids || [],
            best_search: "", slow_search: "", stock_search: "",
            best_mode: "model", slow_mode: "model", stock_mode: "model",
            rem_prob: "", rem_needs: "", 
            recipient_email: s.recipient_email || "Mohamedamine@ma-vie.ma, mohamedelouatiq@ma-vie.ma",
            phone_number: s.phone_number || "+212 681-518100",
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

    getProductName(id) {
        const p = this.products.find(prod => prod.id === id);
        return p ? (p.display_name || p.name) : "Produit #" + id;
    }

    getFilteredProducts(query) {
        if (!query) {
            return this.products.slice(0, 300);
        }
        const q = query.toLowerCase().trim();
        return this.products.filter(p => 
            (p.display_name && p.display_name.toLowerCase().includes(q)) || 
            (p.default_code && p.default_code.toLowerCase().includes(q))
        ).slice(0, 300);
    }

    getUniqueModels() {
        if (this._uniqueModels) return this._uniqueModels;
        const modelsMap = new Map();
        for (const p of this.products) {
            const fullName = p.display_name || p.name || "";
            const parenIndex = fullName.indexOf("(");
            const baseName = parenIndex > -1 ? fullName.substring(0, parenIndex).trim() : fullName.trim();
            const key = baseName || ("product_" + p.id);
            if (!modelsMap.has(key)) {
                modelsMap.set(key, {
                    id: key,
                    display_name: baseName || fullName,
                    variants: []
                });
            }
            modelsMap.get(key).variants.push(p.id);
        }
        this._uniqueModels = Array.from(modelsMap.values()).sort((a, b) => a.display_name.localeCompare(b.display_name));
        return this._uniqueModels;
    }

    getFilteredModels(query) {
        const models = this.getUniqueModels();
        if (!query) return models.slice(0, 50);
        const q = query.toLowerCase().trim();
        return models.filter(m => m.display_name.toLowerCase().includes(q)).slice(0, 50);
    }

    toggleModel(tmplId, fieldIds) {
        const model = this.getUniqueModels().find(m => m.id === tmplId);
        if (!model) return;
        const variants = model.variants;
        const allSelected = variants.every(vid => this.state[fieldIds].includes(vid));
        
        if (allSelected) {
            this.state[fieldIds] = this.state[fieldIds].filter(vid => !variants.includes(vid));
        } else {
            for (const vid of variants) {
                if (!this.state[fieldIds].includes(vid)) {
                    this.state[fieldIds].push(vid);
                }
            }
        }
    }

    isModelSelected(tmplId, fieldIds) {
        const model = this.getUniqueModels().find(m => m.id === tmplId);
        if (!model) return false;
        return model.variants.every(vid => this.state[fieldIds].includes(vid));
    }

    toggleBest(id) {
        const idx = this.state.p_best_ids.indexOf(id);
        if (idx > -1) {
            this.state.p_best_ids.splice(idx, 1);
        } else {
            this.state.p_best_ids.push(id);
        }
    }

    removeBest(id) {
        const idx = this.state.p_best_ids.indexOf(id);
        if (idx > -1) this.state.p_best_ids.splice(idx, 1);
    }

    toggleSlow(id) {
        const idx = this.state.p_slow_ids.indexOf(id);
        if (idx > -1) {
            this.state.p_slow_ids.splice(idx, 1);
        } else {
            this.state.p_slow_ids.push(id);
        }
    }

    removeSlow(id) {
        const idx = this.state.p_slow_ids.indexOf(id);
        if (idx > -1) this.state.p_slow_ids.splice(idx, 1);
    }

    toggleStock(id) {
        const idx = this.state.c_stock_out_ids.indexOf(id);
        if (idx > -1) {
            this.state.c_stock_out_ids.splice(idx, 1);
        } else {
            this.state.c_stock_out_ids.push(id);
        }
    }

    removeStock(id) {
        const idx = this.state.c_stock_out_ids.indexOf(id);
        if (idx > -1) this.state.c_stock_out_ids.splice(idx, 1);
    }

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
            if (s.currentStep === 3) return !!(s.p_ca > 0 && s.p_tickets > 0 && s.p_best_ids.length >= 10 && s.p_slow_ids.length >= 10);
            return true;
        }
    }
    nextStep() {
        if (this.isStepValid()) {
            this.state.currentStep++;
        } else {
            const s = this.state;
            if (s.isClosingMode && s.currentStep === 3) {
                if (s.p_ca <= 0 || s.p_tickets <= 0) {
                    alert(_t("Veuillez remplir les champs obligatoires (CA, Tickets) avant de continuer."));
                } else if (s.p_best_ids.length < 10 || s.p_slow_ids.length < 10) {
                    alert(_t("Veuillez sélectionner au moins 10 articles pour Best Seller et 10 articles pour Slow Seller."));
                }
            } else {
                alert(_t("Veuillez remplir les champs obligatoires (Photo, CA, Tickets) avant de continuer."));
            }
        }
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
                    perf_best_seller_ids: [[6, 0, s.p_best_ids.map(id => parseInt(id))]],
                    perf_slow_seller_ids: [[6, 0, s.p_slow_ids.map(id => parseInt(id))]],
                    closing_stock_out_ids: [[6, 0, s.c_stock_out_ids.map(id => parseInt(id))]],
                    rem_problems: s.rem_prob, 
                    rem_needs: s.rem_needs,
                    closing_cash_rem: s.closing_cash_rem,
                    closing_stock_rem: s.closing_stock_rem,
                    closing_clean_rem: s.closing_clean_rem,
                    closing_sec_rem: s.closing_sec_rem,
                    recipient_email: s.recipient_email, 
                    phone_number: s.phone_number,
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