# -*- coding: utf-8 -*-
{
    'name': 'POS Opening Briefing Checklist',
    'version': '17.0.1.0.0',
    'category': 'Point of Sale',
    'summary': 'Checklist ouverture/fermeture magasin avec envoi email',
    'depends': ['point_of_sale'],
    'data': [
        'security/ir.model.access.csv',
        'data/mail_template.xml',
        'report/pos_session_report.xml',
        'views/pos_session_view.xml',
    ],
    'assets': {
        'point_of_sale._assets_pos': [
            'pos_opening_briefing/static/src/css/briefing.css',
            'pos_opening_briefing/static/src/js/opening_briefing_popup.js',
            'pos_opening_briefing/static/src/js/opening_briefing_button.js',
            'pos_opening_briefing/static/src/js/chrome_patch.js',
            'pos_opening_briefing/static/src/js/closing_session_patch.js',
            'pos_opening_briefing/static/src/xml/opening_briefing_templates.xml',
        ],
    },
    'installable': True,
    'application': False,
    'license': 'LGPL-3',
}
