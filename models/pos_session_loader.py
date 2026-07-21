# -*- coding: utf-8 -*-
from odoo import models

class PosSession(models.Model):
    _inherit = 'pos.session'

    def _pos_ui_models_to_load(self):
        result = super()._pos_ui_models_to_load()
        if 'pos.session' not in result:
            result.append('pos.session')
        return result

    def _loader_params_pos_session(self):
        result = super()._loader_params_pos_session()
        result['search_params']['fields'].extend([
            'opening_checklist_done', 
            'closing_checklist_done', 
            'recipient_email', 
            'phone_number',
            'perf_best_seller_ids',
            'perf_slow_seller_ids',
            'closing_stock_out_ids',
            'state',  # ✅ NOUVEAU - Charge l'état de la session!
        ])
        return result