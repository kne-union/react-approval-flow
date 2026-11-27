import { createWithIntlProvider } from '@kne/react-intl';
import zhCN from './locale/zh-CN';
import enUS from './locale/en-US';

const withLocale = createWithIntlProvider({
  defaultLocale: 'zh-CN',
  messages: {
    // modules-dev / Global 里常见 zh-cn、en-us 小写写法，两边都注册避免 MISSING_TRANSLATION
    'zh-CN': zhCN,
    'zh-cn': zhCN,
    'en-US': enUS,
    'en-us': enUS
  },
  namespace: 'react-approval-flow'
});

export default withLocale;
