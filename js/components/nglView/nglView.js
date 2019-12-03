/**
 * Created by abradley on 01/03/2018.
 */

import { Stage } from 'ngl';
import React, { memo, useEffect, useRef, useCallback, useContext, useState } from 'react';
import { connect, useStore } from 'react-redux';
import * as apiActions from '../../reducers/api/apiActions';
import * as nglActions from '../../reducers/ngl/nglActions';
import * as listTypes from '../listTypes';
import * as selectionActions from '../../reducers/selection/selectionActions';
import { SUFFIX, VIEWS, PREFIX } from '../../constants/constants';
import { isEmpty } from 'lodash';
import { OBJECT_TYPE } from './constants';
import { NglContext } from './nglProvider';
import { defaultFocus, nglObjectDictionary } from '../../reducers/ngl/renderingHelpers';

const NglView = memo(
  ({
    nglOrientations,
    orientationToSet,
    mol_group_list,
    pandda_site_on,
    pandda_site_list,
    duck_yank_data,
    objectsToLoad,
    objectsToDelete,
    objectsLoading,
    objectsInView,
    stageColor,
    targetOnName,
    setMolGroupOn,
    setMolGroupSelection,
    selectVector,
    setDuckYankData,
    setNGLOrientation,
    setPanddaSiteOn,
    setOrientation,
    objectLoading,
    loadObjectSuccess,
    deleteObject,
    loadObject,
    deleteObjectSuccess,
    setLoadingState,
    div_id,
    height,
    mol_group_selection,
    targetIdList,
    target_on,
    setMoleculeList,
    nglProtStyle,
    clearNglView,
    addObjectToNglView
  }) => {
    const store = useStore();
    const ref_data_dict = useRef({
      [listTypes.MOLGROUPS]: {
        oldGroupOn: -1,
        oldGroupsOn: [],
        list: 'mol_group_list',
        onGroup: 'mol_group_on',
        onGroups: 'mol_group_selection'
      },
      [listTypes.PANDDA_SITE]: {
        oldGroupOn: -1,
        oldGroupsOn: [],
        list: 'pandda_site_list',
        onGroup: 'pandda_site_on'
      }
    });

    // connect to NGL Stage object
    const { registerNglView, unregisterNglView, getNglView } = useContext(NglContext);
    const [stage, setStage] = useState();

    /*
    const showLine = (stage, input_dict, object_name) => {
      let shape = new Shape(object_name);
      shape.addLine();
      let shapeComp = stage.addComponentFromObject(shape);
      shapeComp.addRepresentation(MOL_REPRESENTATION.buffer);
    };*/

    const processInt = pickingProxy => {
      let atom_id = '';
      if (pickingProxy.object.atom2.resname === 'HET') {
        atom_id = 'atom1';
      } else {
        atom_id = 'atom2';
      }
      let atom_name = pickingProxy.object[atom_id].atomname;
      let res_name = pickingProxy.object[atom_id].resname;
      let chain_name = pickingProxy.object[atom_id].chainname;
      let res_num = pickingProxy.object[atom_id].resno;
      let tot_name = chain_name + '_' + res_name + '_' + res_num.toString() + '_' + atom_name;
      let mol_int = parseInt(pickingProxy.object.atom1.structure.name.split(PREFIX.COMPLEX_LOAD)[1]);
      return { interaction: tot_name, complex_id: mol_int };
    };

    const toggleMolGroup = groupId => {
      // Anti-pattern but connected prop (mol_group_selection) is undefined here
      const mgs = store.getState().apiReducers.present.mol_group_selection;
      const objIdx = mgs.indexOf(groupId);
      const selectionCopy = mgs.slice();
      if (objIdx === -1) {
        setMolGroupOn(groupId);
        selectionCopy.push(groupId);
        setMolGroupSelection(selectionCopy, stage);
      } else {
        selectionCopy.splice(objIdx, 1);
        setMolGroupSelection(selectionCopy, stage);
      }
    };

    const showPick = (stage, pickingProxy) => {
      if (pickingProxy) {
        // For assigning the ligand interaction
        if (pickingProxy.bond) {
          let input_dict = processInt(pickingProxy);
          if (duck_yank_data['interaction'] !== undefined) {
            deleteObject({
              display_div: VIEWS.MAJOR_VIEW,
              name: duck_yank_data['interaction'] + SUFFIX.INTERACTION
            });
          }
          setDuckYankData(input_dict);
          loadObject({
            start: pickingProxy.object.center1,
            end: pickingProxy.object.center2,
            radius: 0.2,
            display_div: VIEWS.MAJOR_VIEW,
            color: [1, 0, 0],
            name: input_dict['interaction'] + SUFFIX.INTERACTION,
            OBJECT_TYPE: OBJECT_TYPE.ARROW
          });
        } else if (pickingProxy.component.object.name) {
          let name = pickingProxy.component.object.name;
          // Ok so now perform logic
          const type = name.split('_')[0];
          const pk = parseInt(name.split('_')[1], 10);
          if (type === listTypes.MOLGROUPS) {
            toggleMolGroup(pk);
          } else if (type === listTypes.MOLGROUPS_SELECT) {
            toggleMolGroup(pk);
          } else if (type === listTypes.PANDDA_SITE) {
            setPanddaSiteOn(pk);
          }
          //else if (type === listTypes.MOLECULE) {
          //}
          else if (type === listTypes.VECTOR) {
            const vectorSmi = name.split('_')[1];
            selectVector(vectorSmi);
          }
        }
      }
    };

    const checkIfLoading = useCallback(() => {
      for (let key in objectsToLoad) {
        if (objectsToLoad[key]['display_div'] === div_id) {
          setLoadingState(true);
          return false;
        }
      }
      for (let key in objectsLoading) {
        if (objectsLoading[key]['display_div'] === div_id) {
          setLoadingState(true);
          return false;
        }
      }
      setLoadingState(false);
      return true;
    }, [div_id, objectsLoading, setLoadingState, objectsToLoad]);

    const getRadius = data => {
      if (data.mol_id === undefined) {
        return 5.0;
      } else if (data.mol_id.length > 10) {
        return 5.0;
      } else if (data.mol_id.length > 5) {
        return 3.0;
      } else {
        return 2.0;
      }
    };

    const generateSphere = useCallback(
      (data, selected = false, listType = listTypes.MOLGROUPS, view = VIEWS.SUMMARY_VIEW) => {
        let sele = '';
        let color = [0, 0, 1];
        let getCoords = {};

        getCoords[listTypes.MOLGROUPS] = [data.x_com, data.y_com, data.z_com];
        getCoords[listTypes.PANDDA_SITE] = [data.site_native_com_x, data.site_native_com_y, data.site_native_com_z];
        if (selected) {
          sele = 'SELECT';
          color = [0, 1, 0];
        }
        const radius = getRadius(data);
        return Object.assign({}, data, {
          name: listType + sele + '_' + +data.id.toString(),
          display_div: view,
          OBJECT_TYPE: OBJECT_TYPE.SPHERE,
          coords: getCoords[listType],
          radius: radius,
          colour: color
        });
      },
      []
    );

    const showSelect = useCallback(
      (listType, view) => {
        let oldGroup = ref_data_dict.current[listType].oldGroupOn;

        const listOnTemp = ref_data_dict.current[listType].list;
        const onGroupTemp = ref_data_dict.current[listType].onGroup;
        let listOn = undefined;
        let onGroup = undefined;
        if (listOnTemp === 'pandda_site_list') {
          listOn = pandda_site_list;
        }
        if (onGroupTemp === 'pandda_site_on') {
          onGroup = pandda_site_on;
        }

        if (onGroup !== undefined && onGroup !== oldGroup) {
          let old_data;
          let new_data;
          for (let index in listOn) {
            if (listOn[index].id === onGroup) {
              new_data = listOn[index];
            }
            if (listOn[index].id === oldGroup) {
              old_data = listOn[index];
            }
          }
          if (old_data) {
            deleteObject(generateSphere(old_data, true, listType, view));
            loadObject(generateSphere(old_data, false, listType, view));
          }
          // Delete the two old spheres
          if (new_data) {
            deleteObject(generateSphere(new_data, false, listType, view));
            loadObject(generateSphere(new_data, true, listType, view));
          }
          ref_data_dict.current[listType].oldGroupOn = onGroup;
        }
      },
      [deleteObject, generateSphere, loadObject, pandda_site_list, pandda_site_on]
    );

    /*
    const showMultipleSelect = useCallback(
      (listType, view) => {
        let oldGroups = ref_data_dict.current[listType].oldGroupsOn;

        const listOnTemp = ref_data_dict.current[listType].list;
        const onGroupsTemp = ref_data_dict.current[listType].onGroups;

        let listOn = undefined;
        let onGroups = undefined;
        if (listOnTemp === 'mol_group_list') {
          listOn = mol_group_list;
        }
        if (onGroupsTemp !== undefined && onGroupsTemp === 'mol_group_selection') {
          onGroups = mol_group_selection;
        }

        if (onGroups !== undefined && listOn !== undefined) {
          const groupsToRemove = [];
          const groupsToAdd = [];
          listOn.forEach(list => {
            const isInOldGroups = oldGroups.some(g => g === list.id);
            const isInNewGroups = onGroups.some(g => g === list.id);
            if (isInOldGroups && !isInNewGroups) {
              groupsToRemove.push(list);
            } else if (!isInOldGroups && isInNewGroups) {
              groupsToAdd.push(list);
            }
          });
          // change groups that shuld be 'removed'
          groupsToRemove.forEach(data => {
            deleteObject(generateSphere(data, true, listType, view));
            loadObject(generateSphere(data, false, listType, view));
          });
          // change groups that should be 'added'
          groupsToAdd.forEach(data => {
            deleteObject(generateSphere(data, false, listType, view));
            loadObject(generateSphere(data, true, listType, view));
          });
          // update oldGroupsOn array
          ref_data_dict.current[listType].oldGroupsOn = onGroups;
        }
      },
      [deleteObject, generateSphere, loadObject, mol_group_list, mol_group_selection]
    );

    useEffect(() => {
      showMultipleSelect(listTypes.MOLGROUPS, VIEWS.SUMMARY_VIEW);
      showSelect(listTypes.PANDDA_SITE, VIEWS.PANDDA_MAJOR);
    }, [showMultipleSelect, showSelect]);
*/
    /*
    const updateOrientation = useCallback(() => {
      if (orientationToSet !== undefined) {
        if (orientationToSet[div_id] !== 'SET') {
          if (checkIfLoading() === true) {
            let ori = orientationToSet[div_id];
            if (stage) {
              let curr_orient = stage.viewerControls.getOrientation();
              if (
                curr_orient &&
                curr_orient.elements &&
                ori &&
                ori.elements &&
                curr_orient.elements.length === ori.elements.length
              ) {
                for (let i = 0; i < curr_orient.elements.length; i += 1) {
                  curr_orient.elements[i] = ori.elements[i];
                }
              }
              stage.viewerControls.orient(curr_orient);
            }
            setNGLOrientation(div_id, 'SET');
          }
        }
      }
      if (nglOrientations !== undefined) {
        if (nglOrientations[div_id] === 'REFRESH') {
          if (checkIfLoading() === true) {
            let objectsInThisDiv = {};
            for (let key in objectsInView) {
              if (objectsInView[key]['display_div'] === div_id) {
                objectsInThisDiv[key] = objectsInView[key];
              }
            }
            setOrientation(div_id, {
              orientation: stage.viewerControls.getOrientation(),
              components: objectsInThisDiv
            });
          }
        }
      }
      for (let nglKey in objectsLoading) {
        let nglObject = objectsLoading[nglKey];
        if (div_id === nglObject.display_div) {
          if (stage.getComponentsByName(nglKey).list.length > 0) {
            loadObjectSuccess(objectsLoading[nglKey]);
          }
        }
      }
    }, [
      orientationToSet,
      nglOrientations,
      div_id,
      checkIfLoading,
      stage,
      setNGLOrientation,
      setOrientation,
      objectsInView,
      objectsLoading,
      loadObjectSuccess
    ]);





    useEffect(() => {
      setOrientation(div_id, 'STARTED');
      setNGLOrientation(div_id, 'SET');
    }, [div_id, setNGLOrientation, setOrientation]);

    useEffect(() => {
      updateOrientation();
    }, [updateOrientation]);


*/

    /**
     * Function to deal with the logic of showing molecules
     */
    /*
    const renderDisplay = useCallback(() => {
      if (stage && (!isEmpty(objectsToLoad) || !isEmpty(objectsToDelete))) {
        for (let nglKey in objectsToLoad) {
          let nglObject = objectsToLoad[nglKey];
          if (div_id === nglObject.display_div) {
            nglObjectDictionary[nglObject.OBJECT_TYPE](stage, nglObject, nglKey);
            objectLoading(nglObject);
          }
        }
        for (let nglKey in objectsToDelete) {
          if (div_id === objectsToDelete[nglKey].display_div) {
            const comps = stage.getComponentsByName(nglKey);
            for (let component in comps.list) {
              stage.removeComponent(comps.list[component]);
            }
            // Reset focus after receive ResetFocus object
            if (objectsToDelete[nglKey].OBJECT_TYPE === OBJECT_TYPE.RESET_FOCUS) {
              stage.setFocus(defaultFocus);
              stage.autoView();
            }
            deleteObjectSuccess(objectsToDelete[nglKey]);
          }
        }
      }
    }, [stage, objectsToLoad, objectsToDelete, div_id, objectLoading, deleteObjectSuccess]);
*/
    const generateTargetObject = useCallback(
      targetData => {
        // Now deal with this target
        const prot_to_load = window.location.protocol + '//' + window.location.host + targetData.template_protein;
        if (JSON.stringify(prot_to_load) !== JSON.stringify(undefined)) {
          return {
            name: 'PROTEIN_' + targetData.id.toString(),
            prot_url: prot_to_load,
            OBJECT_TYPE: OBJECT_TYPE.PROTEIN,
            nglProtStyle: nglProtStyle
          };
        }
        return undefined;
      },
      [nglProtStyle]
    );

    const loadProtein = useCallback(() => {
      if (target_on !== undefined && targetIdList && stage) {
        let targetData = null;
        targetIdList.forEach(thisTarget => {
          if (thisTarget.id === target_on && targetData === null) {
            targetData = thisTarget;
          }
        });

        setMoleculeList([]);
        if (stage) {
          clearNglView(stage);
        }

        const targObject = generateTargetObject(targetData);
        if (targObject) {
          addObjectToNglView(Object.assign({}, targObject, { display_div: VIEWS.SUMMARY_VIEW }), stage);
          addObjectToNglView(
            Object.assign({}, targObject, {
              display_div: VIEWS.MAJOR_VIEW,
              name: targObject.name + SUFFIX.MAIN
            }),
            stage
          );
        }
      }
    }, [addObjectToNglView, clearNglView, generateTargetObject, setMoleculeList, stage, targetIdList, target_on]);

    // for loading objects in NGL View
    useEffect(() => {
      if (targetIdList && targetIdList.length > 0 && stage) {
        loadProtein();
        if (targetOnName !== undefined) {
          document.title = targetOnName + ': Fragalysis';
        }
      }
    }, [loadProtein, stage, targetIdList, targetOnName]);

    console.log('Render nglView, ');

    // Initialization of NGL View component
    const handleResize = useCallback(() => {
      const newStage = getNglView(div_id);
      if (newStage) {
        newStage.stage.handleResize();
      }
    }, [div_id, getNglView]);

    useEffect(() => {
      const newStage = new Stage(div_id);
      registerNglView(div_id, newStage);
      window.addEventListener('resize', handleResize);
      newStage.mouseControls.add('clickPick-left', showPick);
      setStage(newStage);
      return () => {
        window.removeEventListener('resize', handleResize);
        stage.mouseControls.remove('clickPick-left', showPick);
        unregisterNglView(div_id);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [div_id, handleResize, registerNglView, unregisterNglView]);
    // End of Initialization NGL View component

    return <div id={div_id} style={{ height: height || '600px', width: '100%' }} />;
  }
);
function mapStateToProps(state) {
  return {
    nglOrientations: state.nglReducers.present.nglOrientations,
    orientationToSet: state.nglReducers.present.orientationToSet,
    mol_group_list: state.apiReducers.present.mol_group_list,
    mol_group_selection: state.apiReducers.present.mol_group_selection,
    pandda_site_on: state.apiReducers.present.pandda_site_on,
    pandda_site_list: state.apiReducers.present.pandda_site_list,
    duck_yank_data: state.apiReducers.present.duck_yank_data,
    objectsToLoad: state.nglReducers.present.objectsToLoad,
    objectsToDelete: state.nglReducers.present.objectsToDelete,
    objectsLoading: state.nglReducers.present.objectsLoading,
    objectsInView: state.nglReducers.present.objectsInView,
    stageColor: state.nglReducers.present.backgroundColor,
    targetOnName: state.apiReducers.present.target_on_name,
    targetIdList: state.apiReducers.present.target_id_list,
    target_on: state.apiReducers.present.target_on,
    nglProtStyle: state.nglReducers.present.nglProtStyle
  };
}
const mapDispatchToProps = {
  setMolGroupOn: apiActions.setMolGroupOn,
  setMolGroupSelection: apiActions.setMolGroupSelection,
  selectVector: selectionActions.selectVector,
  setDuckYankData: apiActions.setDuckYankData,
  setNGLOrientation: nglActions.setNGLOrientation,
  setPanddaSiteOn: apiActions.setPanddaSiteOn,
  setOrientation: nglActions.setOrientation,
  objectLoading: nglActions.objectLoading,
  loadObjectSuccess: nglActions.loadObjectSuccess,
  deleteObject: nglActions.deleteObject,
  loadObject: nglActions.loadObject,
  deleteObjectSuccess: nglActions.deleteObjectSuccess,
  setLoadingState: nglActions.setLoadingState,
  setMoleculeList: apiActions.setMoleculeList,
  clearNglView: nglActions.clearNglView,
  addObjectToNglView: nglActions.addObjectToNglView
};

NglView.displayName = 'NglView';

export default connect(mapStateToProps, mapDispatchToProps)(NglView);
