# -*- coding: utf-8 -*-
from odoo import models, fields, api
from datetime import date
import logging
import requests
import json

_logger = logging.getLogger(__name__)

# ============================================================================
# ⚡ CONFIGURATION
# ============================================================================
BREVO_API_KEY = "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"
BREVO_API_URL = "https://api.brevo.com/v3/smtp/email"
BREVO_EMAIL_FROM = "imane.elmoudny@e-polytechnique.ma"
N8N_WEBHOOK_URL = "https://vmi3177604.contaboserver.net/webhook/cashier-form"
RECIPIENT_EMAIL = "Mohamedamine@ma-vie.ma, mohamedelouatiq@ma-vie.ma"


class PosSession(models.Model):
    _inherit = 'pos.session'

    opening_checklist_done = fields.Boolean(string='Ouverture complétée', default=False, copy=False)
    closing_checklist_done = fields.Boolean(string='Fermeture complétée', default=False, copy=False)
    
    # --- PARTIE 1 : OUVERTURE ---
    opening_hour = fields.Char(string="Heure d'ouverture")
    opening_floor_clean = fields.Boolean("Sol propre")
    opening_windows_clean = fields.Boolean("Vitrines propres")
    opening_shelves_clean = fields.Boolean("Rayons propres")
    
    opening_lights_ok = fields.Boolean("Lumières OK")
    opening_radio_ok = fields.Boolean("Radio OK")
    opening_aircon_ok = fields.Boolean("Climatisation OK")
    
    opening_bestsellers_ok = fields.Boolean("Best sellers en avant")
    opening_tidy_products = fields.Boolean("Produits bien rangés")
    opening_sizes_present = fields.Boolean("Pointures présentées 36")
    
    opening_cash_open = fields.Boolean("Caisse ouverte")
    opening_cash_float = fields.Float("Fond de caisse (DH)")
    opening_tpe_ok = fields.Boolean("TPE fonctionnel")
    
    opening_staff_full = fields.Boolean("Présence complète")
    opening_staff_outfit = fields.Boolean("Tenue correcte")
    opening_briefing_done = fields.Boolean("Brief fait")
    opening_photo = fields.Binary("Photo ouverture")

    # --- PARTIE 2 : FERMETURE ---
    closing_hour_manual = fields.Char("Heure fermeture")
    closing_cash_closed = fields.Boolean("Caisse fermée")
    closing_cash_total = fields.Float("Total cash")
    closing_tpe_total = fields.Float("Total TPE")
    closing_cash_compliant = fields.Selection([('yes', 'Oui'), ('no', 'Non')], "Conforme avec POS")
    closing_cash_gap = fields.Char("Écart")
    
    closing_stock_out = fields.Text("REF en rupture")
    closing_stock_anomalies = fields.Text("Anomalies constatées")
    
    closing_shop_clean = fields.Boolean("Magasin propre")
    closing_products_tidy = fields.Boolean("Produits rangés")
    
    closing_lights_off = fields.Boolean("Lumières éteintes")
    closing_door_locked = fields.Boolean("Magasin fermé correctement")
    closing_photo = fields.Binary("Photo fermeture")

    # --- PARTIE 3 : PERFORMANCE JOUR ---
    perf_ca_total = fields.Float("CA total")
    perf_tickets_count = fields.Integer("Nombre de tickets")
    perf_avg_basket = fields.Float("Panier moyen")
    
    perf_best_seller = fields.Many2one("product.product", string="Best seller (Compatibilité)")
    perf_slow_seller = fields.Many2one("product.product", string="Slow seller (Compatibilité)")
    perf_best_seller_ids = fields.Many2many("product.product", "pos_session_best_seller_rel", "session_id", "product_id", string="Best sellers")
    perf_slow_seller_ids = fields.Many2many("product.product", "pos_session_slow_seller_rel", "session_id", "product_id", string="Slow sellers")
    closing_stock_out_ids = fields.Many2many("product.product", "pos_session_stock_out_rel", "session_id", "product_id", string="Ruptures de stock")

    # --- REMARQUES PAR SECTION ---
    opening_clean_rem = fields.Text("Remarques Propreté")
    opening_ambiance_rem = fields.Text("Remarques Ambiance")
    opening_merch_rem = fields.Text("Remarques Merchandising")
    opening_cash_rem = fields.Text("Remarques Caisse")
    opening_staff_rem = fields.Text("Remarques Équipe")
    
    closing_cash_rem = fields.Text("Remarques Caisse Fermeture")
    closing_stock_rem = fields.Text("Remarques Stock")
    closing_clean_rem = fields.Text("Remarques Nettoyage Fermeture")
    closing_sec_rem = fields.Text("Remarques Sécurité")

    # --- CONTACTS RAPPORT ---
    recipient_email = fields.Char("Email destinataire", default="Mohamedamine@ma-vie.ma, mohamedelouatiq@ma-vie.ma")
    phone_number = fields.Char("Numéro WhatsApp", default="+212 681-518100")

    # --- PARTIE 4 : REMARQUES GÉNÉRALES ---
    rem_problems = fields.Text("Problèmes rencontrés")
    rem_needs = fields.Text("Besoins (produits / matériel / RH)")

    # --- SCORES DE CONFORMITÉ CALCULÉS & STOCKÉS ---
    op_team_score = fields.Integer("Score Équipe (%)", compute="_compute_scores", store=True)
    op_clean_score = fields.Integer("Score Propreté (%)", compute="_compute_scores", store=True)
    op_ambiance_score = fields.Integer("Score Ambiance (%)", compute="_compute_scores", store=True)
    op_merch_score = fields.Integer("Score Merchandising (%)", compute="_compute_scores", store=True)
    op_cash_score = fields.Integer("Score Caisse Ouverture (%)", compute="_compute_scores", store=True)
    cl_cash_score = fields.Integer("Score Caisse Fermeture (%)", compute="_compute_scores", store=True)
    cl_clean_score = fields.Integer("Score Nettoyage Fermeture (%)", compute="_compute_scores", store=True)
    cl_sec_score = fields.Integer("Score Sécurité (%)", compute="_compute_scores", store=True)
    op_score = fields.Integer("Score Global Ouverture (%)", compute="_compute_scores", store=True)
    cl_score = fields.Integer("Score Global Fermeture (%)", compute="_compute_scores", store=True)

    # --- PHOTOS ET FRAUDE CALCULÉES & STOCKÉES ---
    photo_ouverture_present = fields.Selection([('yes', 'Présente'), ('no', 'Absente')], "Photo Ouverture Présente", compute="_compute_photos", store=True)
    photo_fermeture_present = fields.Selection([('yes', 'Présente'), ('no', 'Absente')], "Photo Fermeture Présente", compute="_compute_photos", store=True)
    photo_fraude_detectee = fields.Selection([('yes', 'Oui'), ('no', 'Non')], "Fraude Photo Détectée", compute="_compute_photos", store=True)

    @api.depends(
        'opening_staff_full', 'opening_staff_outfit', 'opening_briefing_done',
        'opening_floor_clean', 'opening_windows_clean', 'opening_shelves_clean',
        'opening_lights_ok', 'opening_radio_ok', 'opening_aircon_ok',
        'opening_bestsellers_ok', 'opening_tidy_products', 'opening_sizes_present',
        'opening_cash_open', 'opening_tpe_ok',
        'closing_cash_closed', 'closing_cash_compliant', 'closing_cash_gap',
        'closing_shop_clean', 'closing_products_tidy',
        'closing_lights_off', 'closing_door_locked'
    )
    def _compute_scores(self):
        for session in self:
            op_team_fields = [session.opening_staff_full, session.opening_staff_outfit, session.opening_briefing_done]
            session.op_team_score = int((sum(1 for f in op_team_fields if f) / len(op_team_fields)) * 100) if op_team_fields else 0

            op_clean_fields = [session.opening_floor_clean, session.opening_windows_clean, session.opening_shelves_clean]
            session.op_clean_score = int((sum(1 for f in op_clean_fields if f) / len(op_clean_fields)) * 100) if op_clean_fields else 0

            op_ambiance_fields = [session.opening_lights_ok, session.opening_radio_ok, session.opening_aircon_ok]
            session.op_ambiance_score = int((sum(1 for f in op_ambiance_fields if f) / len(op_ambiance_fields)) * 100) if op_ambiance_fields else 0

            op_merch_fields = [session.opening_bestsellers_ok, session.opening_tidy_products, session.opening_sizes_present]
            session.op_merch_score = int((sum(1 for f in op_merch_fields if f) / len(op_merch_fields)) * 100) if op_merch_fields else 0

            op_cash_fields = [session.opening_cash_open, session.opening_tpe_ok]
            session.op_cash_score = int((sum(1 for f in op_cash_fields if f) / len(op_cash_fields)) * 100) if op_cash_fields else 0

            is_cash_compliant = (session.closing_cash_compliant == 'yes') or (not session.closing_cash_gap or session.closing_cash_gap.strip() in ["", "0"])
            cl_cash_fields = [session.closing_cash_closed, is_cash_compliant]
            session.cl_cash_score = int((sum(1 for f in cl_cash_fields if f) / len(cl_cash_fields)) * 100) if cl_cash_fields else 0

            cl_clean_fields = [session.closing_shop_clean, session.closing_products_tidy]
            session.cl_clean_score = int((sum(1 for f in cl_clean_fields if f) / len(cl_clean_fields)) * 100) if cl_clean_fields else 0

            cl_sec_fields = [session.closing_lights_off, session.closing_door_locked]
            session.cl_sec_score = int((sum(1 for f in cl_sec_fields if f) / len(cl_sec_fields)) * 100) if cl_sec_fields else 0

            op_fields = [
                session.opening_floor_clean, session.opening_windows_clean, session.opening_shelves_clean,
                session.opening_lights_ok, session.opening_radio_ok, session.opening_aircon_ok,
                session.opening_bestsellers_ok, session.opening_tidy_products, session.opening_sizes_present,
                session.opening_cash_open, session.opening_tpe_ok, session.opening_staff_full, session.opening_staff_outfit
            ]
            session.op_score = int((sum(1 for f in op_fields if f) / len(op_fields)) * 100) if op_fields else 0

            cl_fields = [
                session.closing_cash_closed, session.closing_shop_clean, session.closing_products_tidy,
                session.closing_lights_off, session.closing_door_locked, is_cash_compliant
            ]
            session.cl_score = int((sum(1 for f in cl_fields if f) / len(cl_fields)) * 100) if cl_fields else 0

    @api.depends('opening_photo', 'closing_photo')
    def _compute_photos(self):
        for session in self:
            session.photo_ouverture_present = 'yes' if session.opening_photo else 'no'
            session.photo_fermeture_present = 'yes' if session.closing_photo else 'no'

            photo_fraude = 'no'
            if session.opening_photo and session.closing_photo:
                try:
                    def _to_clean_b64(val):
                        if isinstance(val, memoryview):
                            val = bytes(val)
                        if isinstance(val, bytes):
                            val = val.decode('utf-8')
                        return str(val).replace('\n', '').replace('\r', '').replace(' ', '').strip()

                    op_clean = _to_clean_b64(session.opening_photo)
                    cl_clean = _to_clean_b64(session.closing_photo)

                    # Méthode 1 : correspondance exacte
                    if op_clean == cl_clean:
                        photo_fraude = 'yes'
                    # Méthode 2 : similarité (anti-fingerprinting navigateur)
                    # Si taille quasi identique (<1% diff) ET début identique → même image
                    elif len(op_clean) > 100 and len(cl_clean) > 100:
                        len_ratio = min(len(op_clean), len(cl_clean)) / max(len(op_clean), len(cl_clean))
                        if len_ratio > 0.99 and op_clean[:100] == cl_clean[:100]:
                            photo_fraude = 'yes'
                except Exception as e:
                    _logger.warning("Erreur comparaison photos: %s", e)
            session.photo_fraude_detectee = photo_fraude

    def _format_bool(self, val):
        return "✅ Oui" if val else "❌ Non"

    def _build_email_body(self, session):
        best_str = ", ".join(session.perf_best_seller_ids.mapped('display_name')) if session.perf_best_seller_ids else "Non renseigné"
        slow_str = ", ".join(session.perf_slow_seller_ids.mapped('display_name')) if session.perf_slow_seller_ids else "Non renseigné"
        
        op_img_content = session.opening_photo.decode("utf-8") if isinstance(session.opening_photo, bytes) else session.opening_photo
        cl_img_content = session.closing_photo.decode("utf-8") if isinstance(session.closing_photo, bytes) else session.closing_photo
        
        img_opening = f'<img src="data:image/jpeg;base64,{op_img_content}" style="max-width: 100%; border-radius: 8px; border: 1px solid #ddd;"/>' if session.opening_photo else '<p>Pas de photo</p>'
        img_closing = f'<img src="data:image/jpeg;base64,{cl_img_content}" style="max-width: 100%; border-radius: 8px; border: 1px solid #ddd;"/>' if session.closing_photo else '<p>Pas de photo</p>'

        shop_name = session.config_id.name if session.config_id else "Magasin inconnu"

        return f"""
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #333; max-width: 700px; padding: 20px; background-color: #ffffff; border: 1px solid #eee; border-radius: 12px;">
            <div style="text-align: center; margin-bottom: 25px;">
                <h1 style="color: #1a73e8; margin-bottom: 5px; font-size: 24px;">Checklist Magasin - {shop_name}</h1>
                <p style="color: #666; font-size: 14px; margin: 0;">Session : <strong>{session.name}</strong> | Date : {date.today().strftime('%d/%m/%Y')}</p>
            </div>
            
            <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                <h2 style="color: #202124; border-bottom: 2px solid #1a73e8; padding-bottom: 8px; margin-top: 0; font-size: 18px;">PARTIE 1 : OUVERTURE</h2>
                <p><strong>Heure d'ouverture :</strong> {session.opening_hour or '…………………'}</p>
                
                <h3 style="font-size: 16px; margin-bottom: 10px;">Propreté</h3>
                <ul style="list-style: none; padding-left: 0;">
                    <li>{self._format_bool(session.opening_floor_clean)} Sol propre</li>
                    <li>{self._format_bool(session.opening_windows_clean)} Vitrines propres</li>
                    <li>{self._format_bool(session.opening_shelves_clean)} Rayons propres</li>
                </ul>
                <p style="font-style: italic; color: #666; font-size: 13px;">Remarques : {session.opening_clean_rem or 'N/A'}</p>

                <h3 style="font-size: 16px; margin-bottom: 10px;">Ambiance</h3>
                <ul style="list-style: none; padding-left: 0;">
                    <li>{self._format_bool(session.opening_lights_ok)} Lumières OK</li>
                    <li>{self._format_bool(session.opening_radio_ok)} Radio OK</li>
                    <li>{self._format_bool(session.opening_aircon_ok)} Climatisation OK</li>
                </ul>
                <p style="font-style: italic; color: #666; font-size: 13px;">Remarques : {session.opening_ambiance_rem or 'N/A'}</p>

                <h3 style="font-size: 16px; margin-bottom: 10px;">Merchandising</h3>
                <ul style="list-style: none; padding-left: 0;">
                    <li>{self._format_bool(session.opening_bestsellers_ok)} Best sellers en avant</li>
                    <li>{self._format_bool(session.opening_tidy_products)} Produits bien rangés</li>
                    <li>{self._format_bool(session.opening_sizes_present)} Pointures presentées 36</li>
                </ul>
                <p style="font-style: italic; color: #666; font-size: 13px;">Remarques : {session.opening_merch_rem or 'N/A'}</p>

                <h3 style="font-size: 16px; margin-bottom: 10px;">Caisse</h3>
                <ul style="list-style: none; padding-left: 0;">
                    <li>{self._format_bool(session.opening_cash_open)} Caisse ouverte</li>
                    <li><strong>Fond de caisse :</strong> {session.opening_cash_float} DH</li>
                    <li>{self._format_bool(session.opening_tpe_ok)} TPE fonctionnel</li>
                </ul>
                <p style="font-style: italic; color: #666; font-size: 13px;">Remarques : {session.opening_cash_rem or 'N/A'}</p>

                <h3 style="font-size: 16px; margin-bottom: 10px;">Équipe</h3>
                <ul style="list-style: none; padding-left: 0;">
                    <li>{self._format_bool(session.opening_staff_full)} Présence complète</li>
                    <li>{self._format_bool(session.opening_staff_outfit)} Tenue correcte</li>
                    <li>{self._format_bool(session.opening_briefing_done)} Brief fait</li>
                </ul>
                <p style="font-style: italic; color: #666; font-size: 13px;">Remarques : {session.opening_staff_rem or 'N/A'}</p>
            </div>

            <div style="background-color: #fdfdfd; padding: 15px; border-radius: 8px; border: 1px solid #f1f3f4; margin-bottom: 20px;">
                <h2 style="color: #202124; border-bottom: 2px solid #ea4335; padding-bottom: 8px; margin-top: 0; font-size: 18px;">PARTIE 2 : FERMETURE</h2>
                <p><strong>Heure fermeture :</strong> {session.closing_hour_manual or '…………………'}</p>

                <h3 style="font-size: 16px; margin-bottom: 10px;">Caisse</h3>
                <ul style="list-style: none; padding-left: 0;">
                    <li>{self._format_bool(session.closing_cash_closed)} Caisse fermée</li>
                    <li><strong>Total cash :</strong> {session.closing_cash_total} DH</li>
                    <li><strong>Total TPE :</strong> {session.closing_tpe_total} DH</li>
                    <li><strong>Conforme avec POS :</strong> {'Oui' if session.closing_cash_compliant == 'yes' else 'Non'}</li>
                    <li><strong>Écart (si non) :</strong> {session.closing_cash_gap or '………………'}</li>
                </ul>
                <p style="font-style: italic; color: #666; font-size: 13px;">Remarques : {session.closing_cash_rem or 'N/A'}</p>

                <h3 style="font-size: 16px; margin-bottom: 10px;">Stock</h3>
                <p><strong>• REF en rupture :</strong><br/>{session.closing_stock_out or '…………………'}</p>
                <p><strong>• Anomalies constatées :</strong><br/>{session.closing_stock_anomalies or '…………………'}</p>
                <p style="font-style: italic; color: #666; font-size: 13px;">Remarques : {session.closing_stock_rem or 'N/A'}</p>

                <h3 style="font-size: 16px; margin-bottom: 10px;">Nettoyage</h3>
                <ul style="list-style: none; padding-left: 0;">
                    <li>{self._format_bool(session.closing_shop_clean)} Magasin propre</li>
                    <li>{self._format_bool(session.closing_products_tidy)} Produits rangés</li>
                </ul>
                <p style="font-style: italic; color: #666; font-size: 13px;">Remarques : {session.closing_clean_rem or 'N/A'}</p>

                <h3 style="font-size: 16px; margin-bottom: 10px;">Sécurité</h3>
                <ul style="list-style: none; padding-left: 0;">
                    <li>{self._format_bool(session.closing_lights_off)} Lumières éteintes</li>
                    <li>{self._format_bool(session.closing_door_locked)} Magasin fermé correctement</li>
                </ul>
                <p style="font-style: italic; color: #666; font-size: 13px;">Remarques : {session.closing_sec_rem or 'N/A'}</p>
            </div>

            <div style="background-color: #fff8e1; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                <h2 style="color: #202124; border-bottom: 2px solid #fbbc04; padding-bottom: 8px; margin-top: 0; font-size: 18px;">PARTIE 3 : PERFORMANCE JOUR</h2>
                <p><strong>• CA total :</strong> {session.perf_ca_total} DH</p>
                <p><strong>• Nombre de tickets :</strong> {session.perf_tickets_count}</p>
                <p><strong>• Panier moyen :</strong> {session.perf_avg_basket} DH</p>
                <p><strong>• Best seller :</strong> {best_str}</p>
                <p><strong>• Slow seller :</strong> {slow_str}</p>
            </div>

            <div style="background-color: #f1f8e9; padding: 15px; border-radius: 8px;">
                <h2 style="color: #202124; border-bottom: 2px solid #34a853; padding-bottom: 8px; margin-top: 0; font-size: 18px;">PARTIE 4 : REMARQUES GÉNÉRALES</h2>
                <p><strong>• Problèmes rencontrés :</strong><br/>{session.rem_problems or '................................'}</p>
                <p><strong>• Besoins (produits / matériel / RH) :</strong><br/>{session.rem_needs or '................................'}</p>
            </div>
        </div>
        """

    @api.model
    def action_save_checklist(self, session_id, vals):
        _logger.info(f"Début sauvegarde checklist pour session {session_id}")
        try:
            self = self.browse(int(session_id))
            if not self.exists():
                _logger.error(f"Session {session_id} non trouvée")
                return {'error': 'Session non trouvée'}

            for f in ['opening_photo', 'closing_photo']:
                if f in vals and not vals[f]:
                    vals.pop(f)

            # Set Many2one fallback values for backward compatibility
            if 'perf_best_seller_ids' in vals and vals['perf_best_seller_ids']:
                try:
                    best_ids = vals['perf_best_seller_ids'][0][2]
                    vals['perf_best_seller'] = best_ids[0] if best_ids else False
                except Exception:
                    pass
            if 'perf_slow_seller_ids' in vals and vals['perf_slow_seller_ids']:
                try:
                    slow_ids = vals['perf_slow_seller_ids'][0][2]
                    vals['perf_slow_seller'] = slow_ids[0] if slow_ids else False
                except Exception:
                    pass
            if 'closing_stock_out_ids' in vals and vals['closing_stock_out_ids']:
                try:
                    stock_ids = vals['closing_stock_out_ids'][0][2]
                    products = self.env['product.product'].browse(stock_ids)
                    vals['closing_stock_out'] = ", ".join(products.mapped('display_name')) if products else ""
                except Exception:
                    pass

            for f in ['perf_best_seller', 'perf_slow_seller']:
                if f in vals and not vals[f]:
                    vals[f] = False

            is_closing = vals.pop('is_closing', False)
            if not is_closing:
                vals['opening_checklist_done'] = True
            else:
                vals['closing_checklist_done'] = True
            
            self.write(vals)
            _logger.info("Données écrites avec succès dans Odoo")

            if not is_closing:
                _logger.info("Fin sauvegarde checklist (Phase Ouverture). Pas d'envoi.")
                return {'success': True, 'message': 'Ouverture sauvegardée !'}

            # --- EMAIL BODY ---
            email_body = ""
            subject = f"Rapport Checklist Magasin - {self.name}"
            try:
                template = self.env.ref('pos_opening_briefing.email_template_checklist', raise_if_not_found=False)
                if template:
                    email_body = template._render_field('body_html', self.ids)[self.id]
                    subject = template._render_field('subject', self.ids)[self.id]
                else:
                    email_body = self._build_email_body(self)
            except Exception as mail_err:
                _logger.warning(f"Erreur rendu mail (fallback utilisé) : {mail_err}")
                email_body = self._build_email_body(self)

            # --- CHATTER ---
            try:
                if hasattr(self, 'message_post'):
                    self.message_post(body=email_body, subject=subject)
            except Exception as chatter_err:
                _logger.warning(f"Erreur post chatter : {chatter_err}")

            recipient = self.recipient_email or RECIPIENT_EMAIL

            # --- BREVO ---
            try:
                attachments = []
                if self.opening_photo:
                    op_content = self.opening_photo.decode('utf-8') if isinstance(self.opening_photo, bytes) else self.opening_photo
                    attachments.append({
                        "content": op_content.replace('\n', '').replace('\r', ''),
                        "name": f"ouverture_{self.name}.jpg"
                    })
                if self.closing_photo:
                    cl_content = self.closing_photo.decode('utf-8') if isinstance(self.closing_photo, bytes) else self.closing_photo
                    attachments.append({
                        "content": cl_content.replace('\n', '').replace('\r', ''),
                        "name": f"fermeture_{self.name}.jpg"
                    })

                headers = {
                    "accept": "application/json",
                    "api-key": BREVO_API_KEY,
                    "content-type": "application/json"
                }
                payload = {
                    "sender": {"email": BREVO_EMAIL_FROM},
                    "to": [{"email": r.strip()} for r in recipient.replace(';', ',').split(',') if r.strip()],
                    "subject": subject,
                    "htmlContent": email_body,
                    "attachment": attachments
                }
                resp = requests.post(BREVO_API_URL, json=payload, headers=headers, timeout=10)
                _logger.info(f"Réponse Brevo: {resp.status_code} - {resp.text}")
            except Exception as brevo_err:
                _logger.warning(f"Erreur technique envoi Brevo : {brevo_err}")

            # --- N8N ---
            try:
                # Forcer le recalcul et écriture des champs computed
                self.env.flush_all()
                self.invalidate_recordset()

                # ✅ NOM DU MAGASIN CORRECT
                shop_name = self.config_id.name if self.config_id else "Inconnu"

                # ✅ ALERTE UNIQUEMENT sur fraude photo, écart caisse réel, anomalies stock
                has_cash_gap = bool(self.closing_cash_gap and self.closing_cash_gap.strip() not in ["", "0", "0.0"])
                has_stock_anomaly = bool(self.closing_stock_anomalies and self.closing_stock_anomalies.strip())
                has_photo_fraud = (self.photo_fraude_detectee == 'yes')
                cash_not_compliant = (self.closing_cash_compliant == 'no')

                has_alert = has_photo_fraud or has_cash_gap or has_stock_anomaly or cash_not_compliant

                # Pré-calculer best/slow seller
                best_seller_name = ", ".join(self.perf_best_seller_ids.mapped('display_name')) if self.perf_best_seller_ids else ""
                slow_seller_name = ", ".join(self.perf_slow_seller_ids.mapped('display_name')) if self.perf_slow_seller_ids else ""

                n8n_payload = {
                    "session_name": self.name,
                    "shop_name": shop_name,
                    "date": fields.Date.today().strftime('%Y-%m-%d'),

                    # ALERTES
                    "has_alert": has_alert,
                    "is_alert": has_alert,
                    "alert_triggered": "yes" if has_alert else "no",
                    "alert_reasons": {
                        "photo_fraude": has_photo_fraud,
                        "ecart_caisse": has_cash_gap,
                        "anomalies_stock": has_stock_anomaly,
                        "caisse_non_conforme": cash_not_compliant,
                    },

                    # SCORES — clés directes pour n8n
                    "op_score": self.op_score,
                    "cl_score": self.cl_score,
                    "opening_score": self.op_score,
                    "closing_score": self.cl_score,
                    "op_team_score": self.op_team_score,
                    "op_clean_score": self.op_clean_score,
                    "op_ambiance_score": self.op_ambiance_score,
                    "op_merch_score": self.op_merch_score,
                    "op_cash_score": self.op_cash_score,
                    "cl_cash_score": self.cl_cash_score,
                    "cl_clean_score": self.cl_clean_score,
                    "cl_sec_score": self.cl_sec_score,
                    "photo_ouverture_ok": self.photo_ouverture_present == 'yes',
                    "photo_fermeture_ok": self.photo_fermeture_present == 'yes',
                    "photo_fraude_detectee": has_photo_fraud,

                    # OUVERTURE
                    "opening_hour": self.opening_hour or "",
                    "opening_floor_clean": self.opening_floor_clean,
                    "opening_windows_clean": self.opening_windows_clean,
                    "opening_shelves_clean": self.opening_shelves_clean,
                    "opening_lights_ok": self.opening_lights_ok,
                    "opening_radio_ok": self.opening_radio_ok,
                    "opening_aircon_ok": self.opening_aircon_ok,
                    "opening_bestsellers_ok": self.opening_bestsellers_ok,
                    "opening_tidy_products": self.opening_tidy_products,
                    "opening_sizes_present": self.opening_sizes_present,
                    "opening_cash_open": self.opening_cash_open,
                    "opening_staff_full": self.opening_staff_full,
                    "opening_staff_outfit": self.opening_staff_outfit,
                    "opening_briefing_done": self.opening_briefing_done,
                    "opening_clean_rem": self.opening_clean_rem or "",
                    "opening_ambiance_rem": self.opening_ambiance_rem or "",
                    "opening_merch_rem": self.opening_merch_rem or "",
                    "opening_cash_rem": self.opening_cash_rem or "",
                    "opening_staff_rem": self.opening_staff_rem or "",

                    # FERMETURE
                    "closing_cash_closed": self.closing_cash_closed,
                    "closing_cash_total": self.closing_cash_total,
                    "closing_tpe_total": self.closing_tpe_total,
                    "closing_cash_compliant": self.closing_cash_compliant or "no",
                    "closing_cash_gap": self.closing_cash_gap or "",
                    "closing_stock_out": self.closing_stock_out or "",
                    "closing_stock_anomalies": self.closing_stock_anomalies or "",
                    "closing_shop_clean": self.closing_shop_clean,
                    "closing_products_tidy": self.closing_products_tidy,
                    "closing_lights_off": self.closing_lights_off,
                    "closing_door_locked": self.closing_door_locked,
                    "closing_cash_rem": self.closing_cash_rem or "",
                    "closing_stock_rem": self.closing_stock_rem or "",
                    "closing_clean_rem": self.closing_clean_rem or "",
                    "closing_sec_rem": self.closing_sec_rem or "",

                    # REMARQUES GÉNÉRALES
                    "rem_problems": self.rem_problems or "",
                    "rem_needs": self.rem_needs or "",

                    # PERFORMANCE — dans objet + au niveau racine
                    "performance": {
                        "ca": self.perf_ca_total,
                        "tickets": self.perf_tickets_count,
                        "panier_moyen": self.perf_avg_basket,
                        "best_seller": best_seller_name,
                        "slow_seller": slow_seller_name,
                    },
                    "best_seller": best_seller_name,
                    "slow_seller": slow_seller_name,

                    # SESSION INFO
                    "id": self.id,
                    "name": self.name,
                    "start_at": str(self.start_at) if self.start_at else "",
                    "stop_at": str(self.stop_at) if self.stop_at else "",
                    "state": self.state,
                    "perf_ca_total": self.perf_ca_total,
                    "perf_tickets_count": self.perf_tickets_count,
                    "perf_avg_basket": self.perf_avg_basket,
                }

                _logger.info(f"Envoi vers n8n - Magasin: {shop_name} - Alerte: {has_alert}")
                n8n_resp = requests.post(N8N_WEBHOOK_URL, json=n8n_payload, timeout=10)
                _logger.info(f"Réponse n8n: {n8n_resp.status_code} - {n8n_resp.text}")
            except Exception as n8n_err:
                _logger.warning(f"Erreur Webhook n8n (non bloquante) : {n8n_err}")

            return {'success': True, 'message': 'Rapport bien envoyé !'}
        except Exception as e:
            _logger.error(f"Erreur fatale lors de la sauvegarde : {e}", exc_info=True)
            return {'error': str(e)}
            # ============================================================
    # CHAMPS ENVOYÉS AU FRONTEND POS (nécessaire pour "Continuer la vente")
    # ============================================================
    @api.model
    def _load_pos_data_fields(self, config_id):
        params = super()._load_pos_data_fields(config_id)
        params += [
            'opening_checklist_done',
            'closing_checklist_done',
        ]
        return params
