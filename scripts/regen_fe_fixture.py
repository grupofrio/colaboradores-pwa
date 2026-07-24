# -*- coding: utf-8 -*- Regenera el ENVELOPE del fixture del frontend con el
# CODIGO REAL del backend. No se edita a mano: se deriva. (Lección 40)
import importlib.util, sys, json, re
from pathlib import Path

BE = Path(r"C:\Users\yamil\dev\gf-migration-work\source-base\gf_kold_os_m6")
FE = Path(r"C:\Users\yamil\dev\colaboradores-pwa")
FX = FE / "src/modules/caja-conciliacion/m6/fixtures/apiLatestFixture.js"

for n in ("kold_os_m6_audit_core", "kold_os_m6_core"):
    sp = importlib.util.spec_from_file_location(n, BE / "lib" / (n + ".py"))
    m = importlib.util.module_from_spec(sp); sys.modules[n] = m; sp.loader.exec_module(m)
core = sys.modules["kold_os_m6_core"]

report = json.loads((BE / "tests/fixtures/contract_fixture_report.json").read_text(encoding="utf-8"))

src = FX.read_text(encoding="utf-8")
MARK = "M6_API_LATEST_FIXTURE = Object.freeze("
head = src[:src.index(MARK) + len(MARK)]
tail = ")\n"
viejo = json.loads(src[src.index(MARK) + len(MARK):src.rindex(")")])

# ── LINAJE: se PRESERVA el sello viejo, a propósito ──────────────────────────
# Codex: "No intentes arreglar esta divergencia con un SHA temporal que volverá a
# cambiar." El sello del backend (9c23d5d2) cambiará OTRA VEZ al portar a
# grupofrio/gf. Alinearlo hoy daría una falsa sensación de cierre y habría que
# rehacerlo mañana.
#
# Lo que SÍ se regenera es la FORMA del contrato (enums, capabilities, ausencia
# de `corrected`): eso es un desajuste real que hay que corregir ya.
# Lo que NO se toca es de QUÉ commit salió: eso es un estado esperado y
# declarado (expected_pre_migration_lineage_mismatch), no un error a tapar.
SELLO_PRESERVADO = viejo["run"]["auditor_build_sha"]
report = dict(report, auditor_build_sha=SELLO_PRESERVADO)

results = core.derive_rule_results(report)
findings = core.findings_from_results(report, results)
payload = core.build_latest_payload(report, results, findings, {"runs_count": 1})

nuevo_js = json.dumps(payload, indent=2, ensure_ascii=False)
nuevo_js = "\n".join(("  " + l) if i else l for i, l in enumerate(nuevo_js.split("\n")))
FX.write_text(head + nuevo_js + tail, encoding="utf-8")

print("fixture del frontend REGENERADO desde el codigo del backend")
print()
print("  lifecycle_states      : %s -> %s" % (
    viejo["capabilities"]["lifecycle_states"], payload["capabilities"]["lifecycle_states"]))
print("  clave 'corrected'     : %s -> %s" % ("corrected" in viejo, "corrected" in payload))
print("  lifecycle_corrected_detection: %s -> %s" % (
    viejo["capabilities"]["features"].get("lifecycle_corrected_detection"),
    payload["capabilities"]["features"]["lifecycle_corrected_detection"]))
print("  lifecycle_states_unsupported : %s" % list(payload["capabilities"]["lifecycle_states_unsupported"]))
print()
sello_backend = json.loads(
    (BE / "tests/fixtures/contract_fixture_report.json").read_text(encoding="utf-8")
)["auditor_build_sha"]
print("  LINAJE (divergencia deliberada, no un olvido):")
print("    run.auditor_build_sha del fixture : %s  (PRESERVADO)" % payload["run"]["auditor_build_sha"][:12])
print("    sello actual del backend         : %s" % sello_backend[:12])
print("    coinciden                        : %s  <- expected_pre_migration_lineage_mismatch"
      % (payload["run"]["auditor_build_sha"] == sello_backend))
print()
# invariante: las cifras NO se mueven
for k in ("total_rules", "total_incidences"):
    a, b = viejo["summary"][k], payload["summary"][k]
    print("  summary.%-18s: %s -> %s   %s" % (k, a, b, "IGUAL" if a == b else "!! CAMBIO"))
    assert a == b, "las cifras no deben moverse"
