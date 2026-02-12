// src/modules/Codon/CodonModule.tsx
import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useConfigStore } from '@/store/useConfigStore';
import { useLogStore } from '@/store/useLogStore';
import { useCodonStore } from '@/store/useCodonStore';
import { useRAnalysis } from '@/hooks/useRAnalysis';
import { D3CodonUsageChart } from './D3CodonUsageChart';
import { D3MetacodonChart } from './D3MetacodonChart';
import {
		Dna, Play, RefreshCw, AlertCircle, ChevronRight, CheckCircle2,
		BarChart2, Microscope, Download, X, Settings2, Check, Filter, Search
	} from 'lucide-react';
import { readTextFile, writeFile, exists } from '@tauri-apps/plugin-fs';
import { save } from '@tauri-apps/plugin-dialog';
import { join } from '@tauri-apps/api/path';
import { jsPDF } from "jspdf";
import { svg2pdf } from "svg2pdf.js";
import JSZip from 'jszip';

const SITE_OPTIONS = [
	{ value: 'position_E', label: 'E-site (position_E)' },
	{ value: 'position_P', label: 'P-site (position_P)' },
	{ value: 'position_A', label: 'A-site (position_A)' },
	{ value: 'position_+1', label: '+1 Site (position_+1)' },
	{ value: 'position_+2', label: '+2 Site (position_+2)' },
	{ value: 'position_+3', label: '+3 Site (position_+3)' },
];

const SORT_OPTIONS = [
	{ value: 'default', label: 'Default' },
	{ value: 'desc', label: 'Value: High to Low' },
	{ value: 'asc', label: 'Value: Low to High' },
];

export const CodonModule: React.FC = () => {
	const { dbPath, outputPath, bamPath, species, isIndexFound } = useConfigStore();
	const { setExpanded, addLog } = useLogStore();
	const { runRScript, isRunning } = useRAnalysis();

	const {
		hasAnalyzed, usageData, occupancyData, selectedCodon, selectedSite, selectedSort,
		setCodonData, setSelectedCodon, setSelectedSite, setSelectedSort
	} = useCodonStore();

	const [showExportModal, setShowExportModal] = useState(false);
	const [exportTarget, setExportTarget] = useState<'usage' | 'meta'>('usage');
	const [isExporting, setIsExporting] = useState(false);
	const [exportProgress, setExportProgress] = useState({ current: 0, total: 0 });

	const [selectedExportSites, setSelectedExportSites] = useState<string[]>([]);
	const [selectedExportSorts, setSelectedExportSorts] = useState<string[]>(['default']);
	const [selectedExportCodons, setSelectedExportCodons] = useState<string[]>([]);
	const [codonSearchQuery, setCodonSearchQuery] = useState('');

	const [exportSettings, setExportSettings] = useState({ width: 210, height: 148, dpi: 300, format: 'png' as 'png' | 'pdf' });

	const isProjectReady = !!(dbPath && outputPath && species && isIndexFound);

	const filteredExportCodons = useMemo(() => {
		return occupancyData
			.map(d => d.codons_seq)
			.filter(c => c.toLowerCase().includes(codonSearchQuery.toLowerCase()));
	}, [occupancyData, codonSearchQuery]);

	const parseUsageTsv = (text: string) => {
		const lines = text.trim().split('\n');
		if (lines.length < 2) return [];
		const headers = lines[0].trim().split(/\t/).map(h => h.trim().replace(/^"|"$/g, ''));
		return lines.slice(1).map(line => {
			const values = line.trim().split(/\t/);
			return headers.reduce((obj, header, i) => {
				const val = values[i];
				obj[header] = isNaN(Number(val)) ? val?.trim().replace(/^"|"$/g, '') : Number(val);
				return obj;
			}, {} as any);
		});
	};

	const parseOccupancyTsv = (text: string) => {
		const lines = text.trim().split('\n');
		if (lines.length < 2) return [];
		return lines.slice(1).map(line => {
			const parts = line.trim().split(/\t/);
			const codon = parts[0]?.trim().replace(/^"|"$/g, '');
			let values: number[] = [];
			const rawVal = parts[1] || "";
			const cleanVal = rawVal.replace(/^c\(|\)$/g, '').replace(/"/g, '');
			if (cleanVal.includes('|')) values = cleanVal.split('|').map(v => Number(v.trim()));
			else if (cleanVal.includes(',')) values = cleanVal.split(',').map(v => Number(v.trim()));
			else values = cleanVal.split(/\s+/).map(v => Number(v.trim()));
			return { codons_seq: codon, normalized_value: values.filter(n => !isNaN(n)) };
		}).filter(d => d.codons_seq && d.normalized_value.length > 0);
	};

	const handleStartAnalysis = async () => {
		if (!isProjectReady) return;
		setExpanded(true);
		try {
				const scriptId = 'ribo_codon';
				const TXLENS_PATH = await join(dbPath, `${species}.txlens.rda`);
			const FASTA_PATH = await join(dbPath, `${species}.txdb.fa`);
			const finalCoveragePath = await join(outputPath, 'coverage_mRNA.csv');
			const hasCoverage = await exists(finalCoveragePath);
			const customOffsetsPath = await join(outputPath, 'offsets.conf.txt');
			const defaultOffsetsPath = await join(dbPath, 'offsets.conf.txt');
			const finalOffsetsPath = (await exists(customOffsetsPath)) ? customOffsetsPath : defaultOffsetsPath;
			const hasOffsets = await exists(finalOffsetsPath);
			if (!hasCoverage && (!bamPath || !hasOffsets)) {
				throw new Error("Missing 'coverage_mRNA.csv'. Provide BAM and offsets.conf.txt to generate it.");
			}
			addLog("info", `[Codon] Executing R Script: ribo_codon.R`);
				await runRScript(scriptId, ["--coverage", finalCoveragePath, "--txlens", TXLENS_PATH, "--fasta", FASTA_PATH, "--species", species, "--outdir", outputPath, "--bam", bamPath, "--offsets", finalOffsetsPath]);
			const [usageText, occupancyText] = await Promise.all([
				readTextFile(await join(outputPath, 'usage.txt')),
				readTextFile(await join(outputPath, 'codon_occupancy.txt'))
			]);
			setCodonData(parseUsageTsv(usageText), parseOccupancyTsv(occupancyText));
			addLog("success", "[Codon] Analysis complete.");
			setTimeout(() => { if (useLogStore.getState().activeProcessCount === 0) setExpanded(false); }, 800);
		} catch (error: any) { addLog("error", `[Codon] Analysis failed: ${error.message}`); }
	};

	const generateBuffer = async (svgId: string): Promise<Uint8Array | null> => {
		const svg = document.getElementById(svgId) as unknown as SVGSVGElement;
		if (!svg) return null;
		const clonedSvg = svg.cloneNode(true) as SVGSVGElement;
		const w = exportTarget === 'usage' ? 1100 : 800;
		const h = exportTarget === 'usage' ? 500 : 450;
		clonedSvg.setAttribute('width', String(w));
		clonedSvg.setAttribute('height', String(h));
		clonedSvg.querySelectorAll('circle').forEach(c => c.setAttribute('r', '3.5'));

		if (exportSettings.format === 'pdf') {
			const yAxisLabels = clonedSvg.querySelectorAll('.grid text, g > g > text');
			yAxisLabels.forEach(t => {
				const text = t as SVGTextElement;
				const xAttr = parseFloat(text.getAttribute('x') || '0');
				if (xAttr < 0 && !text.getAttribute('transform')?.includes('rotate')) text.setAttribute('dy', '0.15em');
			});
			clonedSvg.querySelectorAll('text').forEach(t => {
				const text = t as SVGTextElement;
				text.setAttribute('font-family', 'Inter, Arial, sans-serif');
				if (!text.getAttribute('fill')) text.setAttribute('fill', '#1e293b');
			});
			const pdf = new jsPDF({
				orientation: exportSettings.width > exportSettings.height ? 'l' : 'p',
				unit: 'mm',
				format: [exportSettings.width, exportSettings.height]
			});
			await svg2pdf(clonedSvg, pdf, { x: 0, y: 0, width: exportSettings.width, height: exportSettings.height });
			return new Uint8Array(pdf.output('arraybuffer'));
		} else {
			const scaleFactor = Math.max(1, exportSettings.dpi / 96);
			const pxWidth = (exportSettings.width * 3.78) * scaleFactor;
			const pxHeight = (exportSettings.height * 3.78) * scaleFactor;
			const canvas = document.createElement('canvas');
			canvas.width = pxWidth; canvas.height = pxHeight;
			const ctx = canvas.getContext('2d'); if (!ctx) return null;
			const serializer = new XMLSerializer();
			const svgBlob = new Blob([serializer.serializeToString(clonedSvg)], { type: 'image/svg+xml;charset=utf-8' });
			const url = URL.createObjectURL(svgBlob); const img = new Image();
			return new Promise((resolve) => {
				img.onload = () => {
					ctx.fillStyle = '#ffffff';
					ctx.fillRect(0, 0, pxWidth, pxHeight); ctx.drawImage(img, 0, 0, pxWidth, pxHeight);
					const base64 = canvas.toDataURL("image/png").split(',')[1];
					const binary = atob(base64);
					const array = new Uint8Array(binary.length);
					for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i);
					URL.revokeObjectURL(url); resolve(array);
				};
				img.src = url;
			});
		}
	};

	const handleExport = async () => {
		try {
			setIsExporting(true);
			const isUsageBatch = exportTarget === 'usage' && (selectedExportSites.length * selectedExportSorts.length > 1);
			const isMetaBatch = exportTarget === 'meta' && selectedExportCodons.length > 1;

			if (isUsageBatch || isMetaBatch) {
				const totalTasks = exportTarget === 'usage'
					? selectedExportSites.length * selectedExportSorts.length
					: selectedExportCodons.length;

				setExportProgress({ current: 0, total: totalTasks });
				const zipPath = await save({
					filters: [{ name: 'ZIP Archive', extensions: ['zip'] }],
					defaultPath: `RiboMeta_Batch_Export_${exportTarget}.zip`
				});
				if (!zipPath) { setIsExporting(false); return; }

				const zip = new JSZip();
				let counter = 0;

				if (exportTarget === 'usage') {
					for (const site of selectedExportSites) {
						for (const sortType of selectedExportSorts) {
							counter++;
							setExportProgress(p => ({ ...p, current: counter }));
							setSelectedSite(site); setSelectedSort(sortType as any);
							await new Promise(r => setTimeout(r, 2000));
							const buffer = await generateBuffer('codon-usage-svg');
							if (buffer) zip.file(`Usage_${site}_${sortType}.${exportSettings.format}`, buffer);
						}
					}
				} else {
					for (const codon of selectedExportCodons) {
						counter++;
						setExportProgress(p => ({ ...p, current: counter }));
						setSelectedCodon(codon);
						await new Promise(r => setTimeout(r, 2000));
						const buffer = await generateBuffer('metacodon-profile-svg');
						if (buffer) zip.file(`Metacodon_${codon.toUpperCase()}.${exportSettings.format}`, buffer);
					}
				}
				const zipBuffer = await zip.generateAsync({ type: 'uint8array' });
				await writeFile(zipPath, zipBuffer);
			} else {
				const svgId = exportTarget === 'usage' ? 'codon-usage-svg' : 'metacodon-profile-svg';
				const suffix = exportTarget === 'usage' ? `Usage_${selectedSite}_${selectedSort}` : `Metacodon_${selectedCodon}`;
				const savePath = await save({
					filters: [{ name: exportSettings.format.toUpperCase(), extensions: [exportSettings.format] }],
					defaultPath: `RiboMeta_Codon_${suffix}.${exportSettings.format}`
				});
				if (!savePath) { setIsExporting(false); return; }
				const buffer = await generateBuffer(svgId);
				if (buffer) await writeFile(savePath, buffer);
			}
			setShowExportModal(false);
			addLog("success", "[Export] Process complete.");
		} catch (e: any) {
			addLog("error", `[Export] Failed: ${e.message}`);
		} finally { setIsExporting(false); }
	};

	const activeOccupancy = occupancyData.find(d => d.codons_seq === selectedCodon);

	const currentChartData = useMemo(() => {
		return usageData.map((item: any) => ({
			codon: item.codon, aminoacid: item.aminoacid, norm_codon_usage: Number(item[selectedSite] || 0)
		}));
	}, [usageData, selectedSite]);

	const currentTitle = useMemo(() => {
		const opt = SITE_OPTIONS.find(o => o.value === selectedSite);
		return `Ribosome Occupancy: ${opt ? opt.label.split('(')[0] : selectedSite}`;
	}, [selectedSite]);

	return (
		<div className="w-full space-y-12 pb-24">
			<header className="flex justify-between items-start">
				<div className="space-y-1">
					<h1 className="text-2xl font-bold text-app-text tracking-tight font-serif italic">Codon Usage & Dynamics</h1>
					<p className="text-xs text-slate-500 flex items-center gap-2"><ChevronRight size={12} className="text-emerald-500" /> Ribosome occupancy analysis at codon resolution.</p>
				</div>
				<div className="flex items-center gap-4 p-3 bg-stone-50 rounded-xl border border-app-border shadow-sm">
					<div className="flex flex-col items-start px-2 border-r border-app-border pr-5 text-[9px] font-black uppercase tracking-widest text-slate-400">
						<span>Environment</span>
						<div className="mt-0.5">{isProjectReady ? <span className="text-emerald-600 flex items-center gap-1"><CheckCircle2 size={10} /> Verified</span> : <span className="text-rose-400 flex items-center gap-1"><AlertCircle size={10} /> Pending</span>}</div>
					</div>
					<button onClick={handleStartAnalysis} disabled={!isProjectReady || isRunning} className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-bold text-xs transition-all active:scale-95 ${isProjectReady && !isRunning ? 'bg-emerald-600 text-white shadow-lg' : 'bg-slate-200 text-slate-400'}`}>
						{isRunning ? <RefreshCw size={12} className="animate-spin" /> : <Play size={12} fill="currentColor" />}
						Execute Analysis
					</button>
				</div>
			</header>

			<AnimatePresence mode="wait">
				{!hasAnalyzed ? (
					<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-96 w-full rounded-[2.5rem] border-2 border-dashed border-app-border flex flex-col items-center justify-center space-y-4">
						<Dna size={48} className="text-slate-200" /><p className="text-xs font-medium text-slate-400 italic">No codon metrics found. Execute analysis pipeline.</p>
					</motion.div>
				) : (
					<motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-16">
						<section className="space-y-6">
							<div className="flex items-center justify-between px-1">
								<div className="flex items-center gap-3">
									<div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-600"><BarChart2 size={16} /></div>
									<h2 className="text-xs font-black uppercase tracking-widest text-slate-400">Site-Specific Occupancy</h2>
								</div>
								<div className="flex gap-3">
									<button onClick={() => {
										setExportTarget('usage');
										setSelectedExportSites([selectedSite]);
										setSelectedExportSorts([selectedSort]);
										setShowExportModal(true);
									}} className="flex items-center gap-2 px-3 py-1.5 bg-stone-100 rounded-lg text-[10px] font-bold border border-app-border hover:bg-emerald-600 hover:text-white transition-all"><Download size={12} /> Export</button>
									<select value={selectedSite} onChange={(e) => setSelectedSite(e.target.value)} className="px-3 py-1.5 bg-stone-100 border border-app-border rounded-lg text-[10px] font-mono font-bold text-emerald-600 focus:outline-none focus:border-emerald-500">
										{SITE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
									</select>
									<select value={selectedSort} onChange={(e) => setSelectedSort(e.target.value as any)} className="px-3 py-1.5 bg-stone-100 border border-app-border rounded-lg text-[10px] font-mono font-bold text-amber-600 focus:outline-none focus:border-amber-500">
										{SORT_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
									</select>
								</div>
							</div>
							<div className="bg-white border border-app-border rounded-[2.5rem] p-4 shadow-sm overflow-x-auto">
								<D3CodonUsageChart id="codon-usage-svg" data={currentChartData} title={currentTitle} sortType={selectedSort} />
							</div>
						</section>
						<section className="space-y-6">
							<div className="flex items-center justify-between px-1">
								<div className="flex items-center gap-3">
									<div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-600"><Microscope size={16} /></div>
									<h2 className="text-xs font-black uppercase tracking-widest text-slate-400">Metacodon Profile</h2>
								</div>
								<div className="flex gap-3">
									<button onClick={() => {
										setExportTarget('meta');
										setSelectedExportCodons([selectedCodon]);
										setShowExportModal(true);
									}} className="flex items-center gap-2 px-3 py-1.5 bg-stone-100 rounded-lg text-[10px] font-bold border border-app-border hover:bg-emerald-600 hover:text-white transition-all"><Download size={12} /> Export</button>
									<select value={selectedCodon} onChange={(e) => setSelectedCodon(e.target.value)} className="px-3 py-1.5 bg-stone-100 border border-app-border rounded-lg text-[10px] font-mono font-bold text-emerald-600 focus:outline-none focus:border-emerald-500">
										{occupancyData.map(d => <option key={d.codons_seq} value={d.codons_seq}>{d.codons_seq.toUpperCase()}</option>)}
									</select>
								</div>
							</div>
							<div className="bg-white border border-app-border rounded-[2.5rem] p-4 shadow-sm relative min-h-[450px]">
								{activeOccupancy ? <D3MetacodonChart id="metacodon-profile-svg" data={activeOccupancy} /> : <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-xs italic">Select a valid codon to view profile</div>}
							</div>
						</section>
					</motion.div>
				)}
			</AnimatePresence>

			<AnimatePresence>
				{showExportModal && (
					<div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
						<motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-app-card w-full max-w-md rounded-[2rem] border border-app-border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
							<div className="px-8 py-6 border-b border-app-border flex justify-between items-center bg-stone-50 shrink-0">
								<div className="flex items-center gap-3">
									<div className="p-2 bg-emerald-600 rounded-lg text-white"><Settings2 size={18} /></div>
									<h3 className="text-sm font-black uppercase tracking-widest">{isExporting ? 'Exporting...' : 'Figure Export'}</h3>
								</div>
								{!isExporting && (
									<button onClick={() => setShowExportModal(false)} className="text-slate-400 hover:text-slate-600 p-1 transition-colors"><X size={20} /></button>
								)}
							</div>

							<div className="flex-1 overflow-y-auto p-8 pt-4 space-y-6 scrollbar-thin">
								<fieldset disabled={isExporting} className="space-y-6">
									{exportTarget === 'usage' && (
										<>
											<div className="space-y-3">
												<div className="flex justify-between items-center">
													<label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Target Sites</label>
													<button onClick={() => setSelectedExportSites(SITE_OPTIONS.map(o => o.value))} className="text-[9px] text-emerald-600 font-bold hover:underline">Select All</button>
												</div>
												<div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto pr-1 scrollbar-thin">
													{SITE_OPTIONS.map(opt => (
														<button key={opt.value} onClick={() => setSelectedExportSites(prev => prev.includes(opt.value) ? prev.filter(v => v !== opt.value) : [...prev, opt.value])} className={`px-3 py-2 rounded-lg text-[10px] font-bold border transition-all flex items-center gap-2 ${selectedExportSites.includes(opt.value) ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-app-border text-slate-400'}`}>
															{selectedExportSites.includes(opt.value) ? <Check size={10} strokeWidth={4} /> : <div className="w-2.5 h-2.5" />} {opt.label.split('(')[0]}
														</button>
													))}
												</div>
											</div>
											<div className="space-y-3">
												<div className="flex justify-between items-center">
													<label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Sort Methods</label>
													<button onClick={() => setSelectedExportSorts(SORT_OPTIONS.map(o => o.value))} className="text-[9px] text-amber-600 font-bold hover:underline">Select All</button>
												</div>
												<div className="grid grid-cols-1 gap-2">
													{SORT_OPTIONS.map(opt => (
														<button key={opt.value} onClick={() => setSelectedExportSorts(prev => prev.includes(opt.value) ? prev.filter(v => v !== opt.value) : [...prev, opt.value])} className={`px-3 py-2 rounded-lg text-[10px] font-bold border transition-all flex items-center gap-2 ${selectedExportSorts.includes(opt.value) ? 'bg-amber-600 border-amber-600 text-white' : 'border-app-border text-slate-400'}`}>
															{selectedExportSorts.includes(opt.value) ? <Check size={10} strokeWidth={4} /> : <Filter size={10} />} {opt.label}
														</button>
													))}
												</div>
											</div>
										</>
									)}

									{exportTarget === 'meta' && (
										<div className="space-y-3">
											<div className="flex justify-between items-center">
												<label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Select Codons</label>
												<div className="flex gap-3">
													<button onClick={() => setSelectedExportCodons(occupancyData.map(d => d.codons_seq))} className="text-[9px] text-emerald-600 font-bold hover:underline">All</button>
													<button onClick={() => setSelectedExportCodons([])} className="text-[9px] text-slate-400 font-bold hover:underline">Clear</button>
												</div>
											</div>
											<div className="relative">
												<Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
												<input type="text" placeholder="Search codon (e.g. AUG)..." value={codonSearchQuery} onChange={(e) => setCodonSearchQuery(e.target.value)} className="w-full bg-stone-100 border-2 border-app-border rounded-xl pl-9 pr-4 py-2 text-[11px] font-mono focus:border-emerald-500 outline-none transition-all" />
											</div>
											<div className="grid grid-cols-4 gap-1.5 max-h-48 overflow-y-auto pr-1 scrollbar-thin border-2 border-app-border p-2 rounded-xl bg-stone-50/50">
												{filteredExportCodons.length > 0 ? filteredExportCodons.map(c => (
													<button key={c} onClick={() => setSelectedExportCodons(prev => prev.includes(c) ? prev.filter(v => v !== c) : [...prev, c])} className={`py-1.5 rounded-lg text-[10px] font-mono font-bold border transition-all ${selectedExportCodons.includes(c) ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm scale-95' : 'bg-white border-app-border text-slate-400 hover:border-emerald-500'}`}>
														{c.toUpperCase()}
													</button>
												)) : <div className="col-span-4 py-8 text-center text-[10px] text-slate-400 italic">No matches.</div>}
											</div>
											<div className="text-[9px] text-slate-400 font-medium italic text-right px-1">Selected: {selectedExportCodons.length} codons</div>
										</div>
									)}

									<div className="space-y-2">
										<label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Format</label>
										<div className="flex gap-4">
											{['png', 'pdf'].map((fmt) => (
												<button key={fmt} onClick={() => setExportSettings({ ...exportSettings, format: fmt as any })} className={`flex-1 py-3 rounded-xl text-[11px] font-black uppercase border-2 transition-all ${exportSettings.format === fmt ? 'border-emerald-600 bg-emerald-600/5 text-emerald-600' : 'border-app-border text-slate-400'}`}>{fmt}</button>
											))}
										</div>
									</div>
									<div className="grid grid-cols-2 gap-5">
										<div className="space-y-2"><label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Width (mm)</label><input type="number" value={exportSettings.width} onChange={(e) => setExportSettings({ ...exportSettings, width: Math.max(1, Number(e.target.value)) })} className="w-full bg-app-input border-2 border-app-border rounded-xl px-4 py-2.5 text-xs focus:border-emerald-500" /></div>
										<div className="space-y-2"><label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Height (mm)</label><input type="number" value={exportSettings.height} onChange={(e) => setExportSettings({ ...exportSettings, height: Math.max(1, Number(e.target.value)) })} className="w-full bg-app-input border-2 border-app-border rounded-xl px-4 py-2.5 text-xs focus:border-emerald-500" /></div>
									</div>
									<div className="space-y-2"><label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">DPI (#PNG Only)</label><input type="number" min={1} value={exportSettings.dpi} onChange={(e) => setExportSettings({ ...exportSettings, dpi: Math.max(1, Number(e.target.value)) })} className="w-full bg-app-input border-2 border-app-border rounded-xl px-4 py-2.5 text-xs font-bold text-emerald-600" /></div>
								</fieldset>
							</div>

							<div className="p-8 pt-6 pb-10 border-t border-app-border bg-stone-50/30 shrink-0">
								<button
									onClick={handleExport}
									disabled={isExporting || (exportTarget === 'usage' && (selectedExportSites.length === 0 || selectedExportSorts.length === 0)) || (exportTarget === 'meta' && selectedExportCodons.length === 0)}
									className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg active:scale-95 flex items-center justify-center gap-3 ${isExporting ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-emerald-600 text-white hover:bg-emerald-500'}`}
								>
									{isExporting ? (
										<><RefreshCw size={14} className="animate-spin" /> Generating: {exportProgress.current} / {exportProgress.total}</>
									) : (
										'Download Results'
									)}
								</button>
							</div>
						</motion.div>
					</div>
				)}
			</AnimatePresence>
		</div>
	);
};

