import { useState } from 'react';
import { KeyboardAvoidingView, Platform, TextInput, View } from 'react-native';

import { Icon } from '@/components/icon';
import { Button, Card, Row, Screen, T } from '@/components/ui';
import { errorMessage, requestLoginCode } from '@/lib/api';
import { useSession } from '@/lib/session';
import { font, radius, useTheme } from '@/lib/theme';

const DOMAIN = process.env.EXPO_PUBLIC_ALLOWED_DOMAIN ?? 'netlife.net.ec';

export default function Login() {
  const t = useTheme();
  const { signInWithCode } = useSession();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);

  const input = {
    fontFamily: font.semibold, fontSize: 17, color: t.ink, backgroundColor: t.surface, borderColor: t.line, borderWidth: 1.5,
    borderRadius: radius.md, paddingHorizontal: 16, minHeight: 54,
  } as const;

  async function sendCode() {
    const e = email.trim().toLowerCase();
    if (!e.endsWith('@' + DOMAIN)) { setMsg({ text: `Usa tu correo institucional @${DOMAIN}.`, error: true }); return; }
    setBusy(true); setMsg(null);
    try {
      const { data } = await requestLoginCode({ email: e });
      setStep('code');
      setMsg({ text: data.devCode ? `Emulador: tu código es ${data.devCode}` : `Te enviamos un código de 6 dígitos a ${e}. Revisa también la bandeja de correo no deseado.` });
    } catch (err) {
      setMsg({ text: errorMessage(err), error: true });
    } finally { setBusy(false); }
  }

  async function verify() {
    setBusy(true); setMsg(null);
    try { await signInWithCode(email.trim().toLowerCase(), code.trim()); }
    catch (err) { setMsg({ text: errorMessage(err), error: true }); setBusy(false); }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: t.bg }}>
      <Screen>
        <View style={{ gap: 22, paddingTop: 48 }}>
          <Row style={{ gap: 12 }}>
            <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: t.brand, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="gradas" color={t.brandInk} size={28} />
            </View>
            <View>
              <T v="label">Netlife</T>
              <T v="h3">Comité de Seguridad y Salud</T>
            </View>
          </Row>
          <T v="h1" style={{ fontSize: 44, lineHeight: 48 }}>Muévete</T>
          <T color={t.muted}>Registra tus actividades de gimnasio, piscina, fútbol y gradas, suma puntos y compite con tu departamento.</T>

          {step === 'email' ? (
            <View style={{ gap: 10 }}>
              <T v="small" color={t.ink}>Correo institucional</T>
              <TextInput
                nativeID="email" accessibilityLabel="Correo institucional" value={email} onChangeText={setEmail}
                placeholder={`nombre@${DOMAIN}`} placeholderTextColor={t.muted} autoCapitalize="none" autoComplete="email"
                keyboardType="email-address" textContentType="emailAddress" returnKeyType="send" onSubmitEditing={sendCode} style={input}
              />
              <Button title="Recibir código" onPress={sendCode} loading={busy} disabled={!email.trim()} />
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              <T v="small" color={t.ink}>Código de 6 dígitos</T>
              <TextInput
                nativeID="code" accessibilityLabel="Código de 6 dígitos" value={code} onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000" placeholderTextColor={t.muted} keyboardType="number-pad" autoComplete="one-time-code"
                textContentType="oneTimeCode" maxLength={6} onSubmitEditing={verify}
                style={[input, { fontFamily: font.extrabold, fontSize: 28, letterSpacing: 10, textAlign: 'center' }]}
              />
              <Button title="Ingresar" onPress={verify} loading={busy} disabled={code.length !== 6} />
              <Button title="Usar otro correo" variant="ghost" onPress={() => { setStep('email'); setCode(''); setMsg(null); }} />
            </View>
          )}

          {msg ? (
            <Card style={{ backgroundColor: msg.error ? t.warn + '1A' : t.brandSoft, borderColor: 'transparent' }}>
              <T color={msg.error ? t.warn : t.ink}>{msg.text}</T>
            </Card>
          ) : null}
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}
