import { createApp } from "vue";
import ElementPlus from "element-plus";
import "element-plus/dist/index.css";
import "element-plus/theme-chalk/dark/css-vars.css";
import zhCn from "element-plus/es/locale/lang/zh-cn";
import "virtual:uno.css";
import Dashboard from "./Dashboard.vue";

const app = createApp(Dashboard);
app.use(ElementPlus, {
  locale: zhCn,
});
app.mount("#app");
