sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel",
  "sap/m/MessageToast"
], (Controller, JSONModel, MessageToast) => {
  "use strict";

  return Controller.extend("project1.controller.View1", {

    onInit() {
      this.getView().setModel(new JSONModel({ history: [] }), "chat");
    },

   
    onToggleSideContent() {
      const oToolPage = this.getView().byId("toolPage");
      if (oToolPage) {
        oToolPage.setSideExpanded(!oToolPage.getSideExpanded());
      }
    },

    async onSend(oEvent) {
      const oView  = this.getView();
      const oModel = oView.getModel("chat");
      const aHist  = oModel.getProperty("/history") || [];
      const oInput = oView.byId("msgInput");
      const sText  = (oInput.getValue() || "").trim();

      if (!sText) {
        MessageToast.show("Lütfen bir mesaj yazın");
        return;
      }

      aHist.push({ role: "user", content: sText });
      oModel.setProperty("/history", aHist);
      oInput.setValue("");
      this._scrollToBottom();

      try {
        const url = "/ai/chat";
        const body = { message: sText, history: aHist };

        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        });

        const raw = await res.text();
        let data;
        try { data = raw ? JSON.parse(raw) : {}; } catch { data = { content: raw }; }
        if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);

        aHist.push({ role: "assistant", content: data?.content || data?.text || "" });
      } catch (e) {
        aHist.push({ role: "assistant", content: `Hata: ${e.message}` });
      }

      oModel.setProperty("/history", aHist);
      this._scrollToBottom();
    },

  
    onCopyMessage(oEvent) {
      const oSource = oEvent.getSource();
      
      const oItem = oSource?.getParent()?.getParent();
      const oCtx  = oItem?.getBindingContext("chat");
      const text  = oCtx?.getProperty("content") || "";
      const done  = () => MessageToast.show("Mesaj kopyalandı");

      if (navigator?.clipboard?.writeText) {
        navigator.clipboard.writeText(text)
          .then(done)
          .catch(() => MessageToast.show("Kopyalama başarısız"));
      } else {
        MessageToast.show("Kopyalama desteklenmiyor");
      }
    },

  
   
    _scrollToBottom() {
      setTimeout(() => {
        const oScroll = this.byId("scroll");                  
        const scDom   = oScroll?.getDomRef?.();
        if (scDom) {
          requestAnimationFrame(() => { scDom.scrollTop = scDom.scrollHeight; });
          return;
        }
        const oList = this.byId("msgList");                  
        const dom   = oList?.getDomRef?.();
        if (dom) {
          requestAnimationFrame(() => { dom.scrollTop = dom.scrollHeight; });
        }
      }, 0);
    }

  });
});
