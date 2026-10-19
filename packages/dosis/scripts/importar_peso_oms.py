"""Extrae referencias OMS de peso/edad; no contiene reglas de dosis ni datos de pacientes."""

import hashlib
import io
import json
from pathlib import Path
import urllib.request
import xml.etree.ElementTree as ET
import zipfile

FUENTES = [
    "https://cdn.who.int/media/docs/default-source/child-growth/child-growth-standards/indicators/weight-for-age/wfa_girls_0-to-5-years_zscores.xlsx?sfvrsn=4c03b8db_7",
    "https://cdn.who.int/media/docs/default-source/child-growth/child-growth-standards/indicators/weight-for-age/wfa_boys_0-to-5-years_zscores.xlsx?sfvrsn=97a05331_9",
    "https://cdn.who.int/media/docs/default-source/child-growth/growth-reference-5-19-years/weight-for-age-%285-10-years%29/hfa-girls-z-who-2007-exp_7ea58763-36a2-436d-bef0-7fcfbadd2820.xlsx?sfvrsn=6ede55a4_4",
    "https://cdn.who.int/media/docs/default-source/child-growth/growth-reference-5-19-years/weight-for-age-%285-10-years%29/hfa-boys-z-who-2007-exp_0ff9c43c-8cc0-4c23-9fc6-81290675e08b.xlsx?sfvrsn=b3ca0d6f_4",
]
NS = {"s": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}


def filas_xlsx(datos):
    with zipfile.ZipFile(io.BytesIO(datos)) as libro:
        compartidos = []
        if "xl/sharedStrings.xml" in libro.namelist():
            arbol = ET.fromstring(libro.read("xl/sharedStrings.xml"))
            compartidos = ["".join(si.itertext()) for si in arbol.findall("s:si", NS)]
        hoja = ET.fromstring(libro.read("xl/worksheets/sheet1.xml"))
        filas = []
        for fila in hoja.findall("s:sheetData/s:row", NS):
            valores = []
            for celda in fila.findall("s:c", NS):
                valor = celda.find("s:v", NS)
                texto = valor.text if valor is not None else ""
                if celda.get("t") == "s":
                    texto = compartidos[int(texto)]
                elif celda.get("t") == "inlineStr":
                    texto = "".join(celda.find("s:is", NS).itertext())
                valores.append(texto)
            filas.append(valores)
        return filas


def main():
    fuentes = []
    rangos = {}
    for url in FUENTES:
        peticion = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(peticion, timeout=60) as respuesta:
            datos = respuesta.read()
        filas = filas_xlsx(datos)
        cabecera = filas[0]
        indices = [cabecera.index(c) for c in ["Month", "SD3neg", "SD3"]]
        edades = []
        for fila in filas[1:]:
            if not fila or not fila[0]:
                continue
            mes, minimo, maximo = (float(fila[i]) for i in indices)
            assert mes.is_integer() and 0 <= mes <= 120
            assert 0 < minimo < maximo < 150, "Comprobar que el recurso contiene pesos en kg"
            mes = int(mes)
            edades.append(mes)
            anterior = rangos.get(mes, (minimo, maximo))
            rangos[mes] = (min(anterior[0], minimo), max(anterior[1], maximo))
        assert edades == list(range(edades[0], edades[-1] + 1))
        fuentes.append({"url": url, "sha256": hashlib.sha256(datos).hexdigest()})
    assert sorted(rangos) == list(range(121))
    destino = Path(__file__).resolve().parents[1] / "data"
    destino.mkdir(exist_ok=True)
    salida = {"fuentes": fuentes, "columnas": ["edadMeses", "minKg", "maxKg"],
              "rangos": [[mes, *rangos[mes]] for mes in sorted(rangos)]}
    (destino / "peso-oms.json").write_text(json.dumps(salida, indent=2) + "\n", encoding="utf-8")
    print(f"{len(rangos)} meses extraídos de {len(fuentes)} tablas oficiales")


if __name__ == "__main__":
    main()
