from odoo import http
from odoo.http import request
import logging

_logger = logging.getLogger(__name__)


class PosChecklistController(http.Controller):

    @http.route('/pos/briefing/check', type='json', auth='user')
    def check_briefing(self, **kw):
        """Vérifie si la checklist a été remplie"""
        try:
            session_id = kw.get('session_id')
            if not session_id:
                return {'error': 'No session'}

            session = request.env['pos.session'].sudo().browse(int(session_id))
            if not session.exists():
                return {'error': 'Session not found'}

            return {
                'briefing_done': session.opening_checklist_done,
                'session_name': session.name,
            }
        except Exception as e:
            _logger.error(f"Erreur: {str(e)}")
            return {'error': str(e)}

    @http.route('/pos/briefing/save', type='json', auth='user')
    def save_briefing(self, **kw):
        """Sauvegarde la checklist"""
        try:
            session_id = kw.get('session_id')
            vals = kw.get('data', {})

            if not session_id:
                return {'error': 'No session'}

            result = request.env['pos.session'].action_save_checklist(session_id, vals)
            return result

        except Exception as e:
            _logger.error(f"Erreur: {str(e)}")
            return {'error': str(e)}