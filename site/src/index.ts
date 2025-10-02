import { mount } from 'ripple';
import { Layout } from './Layout.ripple';
import './styles/index.css';
import { inject } from "@vercel/analytics"

inject()

mount(Layout, {
	target: document.getElementById('root'),
});
