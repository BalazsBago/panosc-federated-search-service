import Qty = require('js-quantities');
import {Filter, Where, Condition} from '@loopback/repository';
import {Dataset} from './models';
import {SciCatDataset, SciCatSample} from './scicat-interfaces';
import {
  PanDataset,
  PanDocument,
  PanFile,
  PanInstrument,
  PanMeasurement,
  PanSample,
  PanTechnique,
} from './pan-interfaces';

export interface Query {
  variable: string;
  operator: string;
  value: number;
  unit: string;
}

export interface Loopback3Query {
  include?: Object;
  limit?: number;
  offset?: number;
  skip?: number;
  where?: Object;
}

export interface Operator {
  [x: string]: number;
}

export interface LoopBackQuery {
  [variable: string]: Operator;
}

export interface SciCatPublishedData {
  doi: string;
  title: string;
  abstract: string;
  datasets: SciCatDataset[];
  creationTime: string;
}

export function convertUnits(name: string, value: number, unit: string) {
  const qtyString = String(value) + ' ' + unit;
  const qty = new Qty(qtyString);
  const convertedQuantity = qty.toBase().toString();

  const convertedUnit = convertedQuantity.substr(
    convertedQuantity.indexOf(' ') + 1,
  );
  const convertedValue = convertedQuantity.substr(
    0,
    convertedQuantity.indexOf(' '),
  );
  const floatConverted = parseFloat(convertedValue);
  // add logic for wavlength in units of energy
  if (name === 'wavelength' && convertedUnit === 'J') {
    // if units are in energy
    // convert to joules than length
    const planckConstant = 6.62607015e-34;
    const speedOfLight = 2.99792458e8;
    const lambda = (planckConstant * speedOfLight) / floatConverted;
    return lambda;
  }
  return floatConverted;
}

export function convertNameforScicat(panoscName: string) {
  return 'scientificMetadata.' + panoscName + '.value';
}

export function convertQueryForSciCat(filter?: Filter<Dataset>) {
  const scicatQuery: Loopback3Query = {};
  if (filter !== undefined && typeof filter !== undefined) {
    if ('include' in filter!) {
      const include = filter!['include'];
      if (include !== undefined && typeof include !== undefined) {
        scicatQuery['include'] = filter['include'];
      }
    }
    if ('limit' in filter!) {
      const limit = filter!['limit'];
      if (limit !== undefined && typeof limit !== undefined) {
        scicatQuery['limit'] = limit;
      }
    }
    if ('skip' in filter!) {
      const skip = filter!['skip'];
      if (skip !== undefined && typeof skip !== undefined) {
        scicatQuery['skip'] = skip;
      } else {
        scicatQuery['skip'] = 0;
      }
    }
    const where = filter!.where;
    if (where !== undefined && typeof where !== undefined) {
      if ('and' in where) {
        const parameterSearchArray: LoopBackQuery[] = [];
        where.and.forEach((element: Object) => {
          const query1 = element as Query;
          console.log(query1);
          const convertedValue = convertUnits(
            query1.variable,
            query1.value,
            query1.unit,
          );
          const convertedName = convertNameforScicat(query1.variable);
          const andElement: Where = {
            [convertedName]: {
              [query1.operator]: convertedValue,
            },
          };
          parameterSearchArray.push(andElement);
        });
        scicatQuery['where'] = {and: parameterSearchArray};
      } else if ('or' in where) {
        const parameterSearchArray: LoopBackQuery[] = [];
        where.or.forEach((element: Object) => {
          const query1 = element as Query;
          console.log(query1);
          const convertedValue = convertUnits(
            query1.variable,
            query1.value,
            query1.unit,
          );
          const convertedName = convertNameforScicat(query1.variable);

          const andElement: Where = {
            [convertedName]: {
              [query1.operator]: convertedValue,
            },
          };
          parameterSearchArray.push(andElement);
        });
        scicatQuery['where'] = {or: parameterSearchArray};
      } else if ('query' in where) {
        const query2 = where!.query as Query;
        const convertedValue = convertUnits(
          query2.variable,
          query2.value,
          query2.unit,
        );
        const convertedName = convertNameforScicat(query2.variable);
        const condition: Where = {
          [convertedName]: {
            [query2.operator]: convertedValue,
          },
        };
        scicatQuery['where'] = condition;
      } else {
        const scicatWhere = mapPanPropertiesToScicatProperties(where);
        scicatQuery['where'] = scicatWhere;
      }
    }
  }
  const jsonString = JSON.stringify(scicatQuery);
  console.log(jsonString);
  const jsonLimits = encodeURIComponent(jsonString);
  return jsonLimits;
}

export function mapPanPropertiesToScicatProperties(where: Condition<Filter>) {
  const scicatWhere: Where = {};

  const scicatEquivalent: {[id: string]: string} = {
    pid: 'doi',
    title: 'title',
  };

  Object.keys(where).forEach(key => {
    console.log(key);
    const scicatKey = scicatEquivalent[key];
    console.log(scicatKey);
    const whereObject = where as {[id: string]: string};
    scicatWhere[scicatKey] = whereObject[key];
    console.log(' value of key ', whereObject[key]);
    // "10.17199/165f8a52-c15d-4c96-ad7d-fb0cbe969f66"
  });
  return scicatWhere;
}

export function idquery(pid: string) {
  const scicatQuery = {id: pid};
  const jsonString = JSON.stringify(scicatQuery);
  console.log(jsonString);
  const jsonLimits = encodeURIComponent(jsonString);
  return jsonLimits;
}

export function convertDatasetToPaN(scicatDataset: SciCatDataset) {
  const panDataset: PanDataset = {
    pid: scicatDataset.pid,
    isPublic: true,
    title: scicatDataset.datasetName,
    creationDate: scicatDataset.creationTime,
    size: scicatDataset.size,
  };
  const paramArray: PanMeasurement[] = [];
  if ('scientificMetadata' in scicatDataset) {
    Object.keys(scicatDataset.scientificMetadata).forEach((key: string) => {
      // console.log('key', key);
      const panParam = {
        name: key,
        value: scicatDataset.scientificMetadata[key]['value'],
        unit: scicatDataset.scientificMetadata[key]['unit'],
      };
      paramArray.push(panParam);
    });
    panDataset.parameters = paramArray;
  }
  // Samples
  const sampleArray: PanSample[] = [];
  if ('samples' in scicatDataset) {
    scicatDataset.samples.forEach((value: SciCatSample) => {
      console.log('sample', value);
      const panSample = {
        pid: value.sampleId,
        title: value.description,
      };
      sampleArray.push(panSample);
    });
  }
  panDataset.samples = sampleArray;
  // Techniques
  let techniqueArray: PanTechnique[] = [];
  if ('techniques' in scicatDataset) {
    console.log('techniques', scicatDataset['techniques']);
    techniqueArray = techniqueArray.concat(scicatDataset['techniques']);
  }
  panDataset.techniques = techniqueArray;
  // Instrument
  let instrument: PanInstrument = {pid: '11', name: 'a'};
  if ('instrument' in scicatDataset) {
    console.log('instrument', scicatDataset['instrument']);
    instrument = scicatDataset['instrument'];
  }
  panDataset.instrument = instrument;
  // Files
  const files: PanFile[] = [];
  if ('datablocks' in scicatDataset) {
    console.log('datablocks', scicatDataset['datablocks']);
  }
  panDataset.files = files;
  return panDataset;
}

export function convertSampleToPaN(scicatSample: SciCatSample) {
  const panSample: PanSample = {
    pid: scicatSample.sampleId,
    title: scicatSample.description,
  };
  const paramArray: PanMeasurement[] = [];
  if ('scientificMetadata' in scicatSample) {
    Object.keys(scicatSample.scientificMetadata).forEach((key: string) => {
      // console.log('key', key);
      const panParam = {
        name: key,
        value: scicatSample.scientificMetadata[key]['value'],
        unit: scicatSample.scientificMetadata[key]['unit'],
      };
      paramArray.push(panParam);
    });
    panSample.parameters = paramArray;
  }
  return panSample;
}

export function convertDocumentToPaN(scicatPub: SciCatPublishedData) {
  const panDocument: PanDocument = {
    pid: scicatPub.doi,
    title: scicatPub.title,
    summary: scicatPub.abstract,
    type: 'Publication',
    startDate: scicatPub.creationTime,
    endDate: scicatPub.creationTime,
    releaseDate: scicatPub.creationTime,
    license: 'CC-BY-4.0',
  };
  const datasetArray: PanDataset[] = [];
  if ('datasets' in scicatPub) {
    console.log(scicatPub.datasets);
    scicatPub.datasets.forEach((value: SciCatDataset) => {
      console.log('sample', value);
      const panDataset = {
        pid: value.pid,
        title: value.datasetName,
        isPublic: true,
        creationDate: 'string',
        size: 0,
      };
      datasetArray.push(panDataset);
    });
  }
  panDocument.datasets = datasetArray;
  return panDocument;
}
