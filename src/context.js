import { createContext, useContext } from 'react';

const DesignerContext = createContext({});

export const DesignerProvider = DesignerContext.Provider;

export const useDesignerContext = () => useContext(DesignerContext);

export default DesignerContext;
