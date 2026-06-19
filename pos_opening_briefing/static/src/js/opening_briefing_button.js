/** @odoo-module **/

import { Component } from "@odoo/owl";
import { usePos } from "@point_of_sale/app/store/pos_hook";
import { OpeningBriefingPopup } from "./opening_briefing_popup";
import { useService } from "@web/core/utils/hooks";
import { registry } from "@web/core/registry";

export class OpeningBriefingButton extends Component {
    static template = "pos_opening_briefing.OpeningBriefingButton";

    setup() {
        this.pos = usePos();
        this.popup = useService("popup");
    }

    async onClick() {
        this.popup.add(OpeningBriefingPopup, {
            title: "Checklist Magasin",
        });
    }
}

registry.category("pos_control_buttons").add("OpeningBriefingButton", {
    component: OpeningBriefingButton,
});