define([
    'ash',
    'game/constants/PlayerActionConstants',
    'game/constants/PlayerStatConstants',
    'game/constants/TextConstants',
    'game/constants/UIConstants',
    'game/constants/PositionConstants',
    'game/constants/LocaleConstants',
    'game/constants/LevelConstants',
    'game/constants/MovementConstants',
    'game/constants/ItemConstants',
    'game/nodes/PlayerPositionNode',
    'game/nodes/PlayerLocationNode',
    'game/nodes/sector/CampNode',
    'game/components/player/VisionComponent',
    'game/components/player/StaminaComponent',
    'game/components/player/ItemsComponent',
    'game/components/sector/PassagesComponent',
    'game/components/sector/SectorControlComponent',
    'game/components/sector/SectorFeaturesComponent',
    'game/components/sector/SectorLocalesComponent',
    'game/components/sector/MovementOptionsComponent',
    'game/components/common/PositionComponent',
    'game/components/sector/improvements/SectorImprovementsComponent',
    'game/components/sector/improvements/WorkshopComponent',
    'game/components/sector/SectorStatusComponent',
    'game/components/sector/EnemiesComponent'
], function (
    Ash, PlayerActionConstants, PlayerStatConstants, TextConstants, UIConstants, PositionConstants, LocaleConstants, LevelConstants, MovementConstants, ItemConstants,
    PlayerPositionNode, PlayerLocationNode, CampNode,
    VisionComponent, StaminaComponent, ItemsComponent, PassagesComponent, SectorControlComponent, SectorFeaturesComponent, SectorLocalesComponent,
    MovementOptionsComponent, PositionComponent,
    SectorImprovementsComponent, WorkshopComponent, SectorStatusComponent, EnemiesComponent
) {
    var UIOutLevelSystem = Ash.System.extend({
	
		uiFunctions : null,
		gameState : null,
		movementHelper: null,
		resourcesHelper: null,
		sectorHelper: null,
		
		engine: null,
		
		playerPosNodes: null,
		playerLocationNodes: null,
		
		tabChangedSignal: null,
		playerMovedSignal: null,
	
		constructor: function (uiFunctions, tabChangedSignal, gameState, movementHelper, resourceHelper, sectorHelper, uiMapHelper, playerMovedSignal) {
			this.uiFunctions = uiFunctions;
			this.gameState = gameState;
			this.movementHelper = movementHelper;
			this.resourcesHelper = resourceHelper;
			this.sectorHelper = sectorHelper;
            this.uiMapHelper = uiMapHelper;
			this.tabChangedSignal = tabChangedSignal;
			this.playerMovedSignal = playerMovedSignal;
			return this;
		},
	
		addToEngine: function (engine) {
			this.playerPosNodes = engine.getNodeList(PlayerPositionNode);
			this.playerLocationNodes = engine.getNodeList(PlayerLocationNode);
			
			this.initListeners();
			
			this.engine  = engine;
		},

		removeFromEngine: function (engine) {
			this.playerPosNodes = null;
			this.playerLocationNodes = null;
			this.engine = null;
		},
	
		initListeners: function () {
			var uiMapHelper = this.uiMapHelper;
			var sys = this;
			this.playerMovedSignal.add(function () {
				sys.rebuildVis(uiMapHelper);
				sys.updateLocales();
				sys.updateMovementRelatedActions();
			});
			this.rebuildVis(uiMapHelper);
		},
		
		update: function (time) {
            $("#switch-out .bubble").toggle(false);
			
			var posComponent = this.playerPosNodes.head.position;
            
            if (!this.playerLocationNodes.head) {
                return;
            }
			
			if (!posComponent.inCamp) {
				this.updateLevelPage();
			}
		},
		
		updateLevelPage: function () {
			var posComponent = this.playerLocationNodes.head.position;
			var passagesComponent = this.playerLocationNodes.head.entity.get(PassagesComponent);
			var featuresComponent = this.playerLocationNodes.head.entity.get(SectorFeaturesComponent);
			var sectorLocalesComponent = this.playerLocationNodes.head.entity.get(SectorLocalesComponent);
			var sectorStatusComponent = this.playerLocationNodes.head.entity.get(SectorStatusComponent);
			var sectorControlComponent = this.playerLocationNodes.head.entity.get(SectorControlComponent);
            
			var improvements = this.playerLocationNodes.head.entity.get(SectorImprovementsComponent);
			var workshopComponent = this.playerLocationNodes.head.entity.get(WorkshopComponent);
			
			var vision = this.playerPosNodes.head.entity.get(VisionComponent).value;
			var hasVision = vision > PlayerStatConstants.VISION_BASE;
			var hasBridgeableBlocker = this.movementHelper.hasBridgeableBlocker(this.playerLocationNodes.head.entity);
			var passageUpAvailable = passagesComponent.passageUp != null;
			var passageDownAvailable = passagesComponent.passageDown != null;
			var hasCamp = false;
			var hasCampHere = false;
			for (var node = this.engine.getNodeList(CampNode).head; node; node = node.next) {
				var campPosition = node.entity.get(PositionComponent);
				if (campPosition.level === this.playerPosNodes.head.position.level) {
					hasCamp = true;
					if (campPosition.sectorId() === this.playerPosNodes.head.position.sectorId()) hasCampHere = true;
					break;
				}
			}
			
			// Header
			var header = "";
			var name = featuresComponent.getSectorTypeName(hasVision || featuresComponent.sunlit);
			header = name;
            $("#header-sector").text(header);
			
			// Description
			var isScouted = sectorStatusComponent.scouted;
			$("#out-desc").html(this.getDescription(
				this.playerLocationNodes.head.entity,
				hasCampHere,
				hasCamp,
				hasVision,
				isScouted
			));
			
			// Improvements
			var playerActionsHelper = this.uiFunctions.playerActions.playerActionsHelper;
			// TODO performance bottlenneck - only update as needed
			$.each($("#out-improvements tr"), function () {
				var actionName = $(this).find("button.action-build").attr("action");
				if (actionName) {
					var improvementName = playerActionsHelper.getImprovementNameForAction(actionName);
					if (improvementName) {
						var actionEnabled = playerActionsHelper.checkRequirements(actionName, false).value >= 1;
						var existingImprovements = improvements.getCount(improvementName);
						var costSource = PlayerActionConstants.getCostSource(actionName);
						var isProject = costSource === PlayerActionConstants.COST_SOURCE_CAMP;
						$(this).find(".list-amount").text(existingImprovements);
						$(this).find(".action-use").toggle(existingImprovements > 0);
						if (isProject) {
							$(this).find(".list-description").text(actionEnabled ? "Available in camp" : "");
						}
						$(this).toggle(actionEnabled || existingImprovements > 0);
					}
				}
			});
			var collectorFood = improvements.getVO(improvementNames.collector_food);
			var collectorWater = improvements.getVO(improvementNames.collector_water);
			var hasFoundFood = isScouted && featuresComponent.resourcesCollectable.food > 0;
			var hasFoundWater = isScouted && featuresComponent.resourcesCollectable.water > 0;
			$("#out-improvements-collector-food").toggle(collectorFood.count > 0 || hasFoundFood);
			$("#out-improvements-collector-water").toggle((collectorWater.count > 0 || hasFoundWater) && !featuresComponent.hasSpring);
			$("#out-improvements-camp").toggle(sectorStatusComponent.canBuildCamp);
			$("#out-improvements-bridge").toggle(hasBridgeableBlocker);
			$("#out-improvements-passage-up").toggle(isScouted && passageUpAvailable);
			$("#out-improvements-passage-down").toggle(isScouted && passageDownAvailable);
			
			var collectorFoodCapacity = collectorFood.storageCapacity.food * collectorFood.count;
			var collectorWaterCapacity = collectorWater.storageCapacity.water * collectorWater.count;
			$("#out-improvements-camp .list-amount").text(hasCamp ? "1" : "0");
			$("#out-improvements-bridge .list-amount").text(improvements.getCount(improvementNames.bridge));
			$("#out-improvements-collector-food .list-storage").text(
				collectorFoodCapacity > 0 ? (Math.floor(collectorFood.storedResources.food * 10) / 10) + " / " + collectorFoodCapacity : "");
			$("#out-improvements-collector-water .list-storage").text(
				collectorWaterCapacity > 0 ? (Math.floor(collectorWater.storedResources.water * 10) / 10) + " / " + collectorWaterCapacity : "");
			
			$("#out-improvements").toggle(this.gameState.unlockedFeatures.vision);
			var hasAvailableImprovements = $("#out-improvements table tr:visible").length > 0;
			var hasAvailableProjects = $("#out-projects tr:visible").length > 0;
			$("#header-out-improvements").toggle(hasAvailableImprovements);
			$("#header-out-projects").toggle(hasAvailableProjects);
			
			// Actions
			var passageUpBuilt = improvements.getCount(improvementNames.passageUpStairs) +
				improvements.getCount(improvementNames.passageUpElevator) +
				improvements.getCount(improvementNames.passageUpHole) > 0;
			var passageDownBuilt = improvements.getCount(improvementNames.passageDownStairs) +
				improvements.getCount(improvementNames.passageDownElevator) +
				improvements.getCount(improvementNames.passageDownHole) > 0;
			$("#out-action-move-up").toggle((isScouted && passagesComponent.passageUp != null) || passageUpBuilt);
			$("#out-action-move-down").toggle((isScouted && passagesComponent.passageDown != null) || passageDownBuilt);
			$("#out-action-move-camp").toggle(hasCamp && !hasCampHere);
			
			var discoveredResources = this.sectorHelper.getLocationDiscoveredResources();
            var isValidDespairRes = 
                (discoveredResources.indexOf(resourceNames.food) < 0 || discoveredResources.indexOf(resourceNames.water) < 0) &&
                this.gameState.unlockedFeatures.resources.food &&
                this.gameState.unlockedFeatures.resources.water &&
                (this.resourcesHelper.getCurrentStorage().resources.water < 0.5 || this.resourcesHelper.getCurrentStorage().resources.food < 0.5);
            var isValidDespairStamina = this.playerPosNodes.head.entity.get(StaminaComponent).stamina < PlayerActionConstants.costs.move_sector_east.stamina;
			var showDespair = !hasCampHere && (isValidDespairRes || isValidDespairStamina);
			$("#out-action-enter").toggle(hasCampHere);
			$("#out-action-scout").toggle(this.gameState.unlockedFeatures.vision);
			$("#out-action-use-spring").toggle(isScouted && featuresComponent.hasSpring);
			$("#out-action-investigate").toggle(this.gameState.unlockedFeatures.investigate);
			$("#out-action-fight-gang").toggle(this.gameState.unlockedFeatures.fight);
			$("#out-action-despair").toggle(showDespair);
            
			$("#out-action-clear-workshop").toggle(isScouted && workshopComponent != null && !sectorControlComponent.hasControlOfLocale(LocaleConstants.LOCALE_ID_WORKSHOP));
            if (workshopComponent) {
                var workshopName = TextConstants.getWorkshopName(workshopComponent.resource);
                $("#out-action-clear-workshop").text("scout " + workshopName);
            }
			
			this.uiFunctions.slideToggleIf("#out-locales", null, isScouted && sectorLocalesComponent.locales.length > 0, 200, 0);
			this.uiFunctions.slideToggleIf("#table-out-actions-movement-related", null, isScouted > 0, 200, 0);
			
			$("#minimap").toggle(hasVision);
            
            var hasMap = this.playerPosNodes.head.entity.get(ItemsComponent).getCountById(ItemConstants.itemDefinitions.uniqueEquipment[0].id, true) > 0;
            $("#out-position-indicator").text(hasMap ? posComponent.getPosition().getInGameFormat(false) : "");
		},
		
		getDescription: function (entity, hasCampHere, hasCampOnLevel, hasVision, isScouted) {
			var passagesComponent = this.playerLocationNodes.head.entity.get(PassagesComponent);
			var workshopComponent = this.playerLocationNodes.head.entity.get(WorkshopComponent);
			var featuresComponent = this.playerLocationNodes.head.entity.get(SectorFeaturesComponent);
			var hasEnemies = this.playerLocationNodes.head.entity.get(SectorControlComponent).maxSectorEnemies > 0;
			
			var description = "<p>";
			description += this.getTextureDescription(hasVision, featuresComponent);
			description += this.getFunctionalDescription(hasVision, isScouted, featuresComponent, workshopComponent, hasCampHere, hasCampOnLevel);
			description += "</p><p>";
			description += this.getStatusDescription(hasVision, isScouted, hasEnemies, featuresComponent, passagesComponent, hasCampHere, hasCampOnLevel);
			description += this.getMovementDescription(isScouted, passagesComponent, entity);
			description += "</p><p>";
			description += this.getResourcesDescription(isScouted, featuresComponent);
			description += "</p>";
			return description;
		},
		
		// Sector type, density, repair. Sunlight.
		getTextureDescription: function (hasVision, featuresComponent) {
			var desc = TextConstants.getSectorDescription(
				hasVision,
				featuresComponent.sunlit,
				featuresComponent.sectorType,
				featuresComponent.buildingDensity,
				featuresComponent.stateOfRepair) + " ";
			
			if (featuresComponent.sunlit) {
				if (hasVision) desc += "The area is swathed in relentless daylight. ";
				else desc += "The area is swathed in blinding sunlight. ";
			} else {
                if (hasVision) desc += "";
                else desc += "There is no light.";
            }
			
			return desc;
		},
		
		// Existing improvements. Workshops. Passages. Potential improvements (camp).
		getFunctionalDescription: function (hasVision, isScouted, featuresComponent, workshopComponent, hasCampHere, hasCampOnLevel) {
			var sectorControlComponent = this.playerLocationNodes.head.entity.get(SectorControlComponent);
            
			var description = "";
            
            if (isScouted && featuresComponent.hasSpring) {
                description += "There is a <span class='text-highlight-functionality'>" + TextConstants.getSpringName(featuresComponent) + "</span> here. ";
            }
            
			if (hasCampHere) description += "There is a <span class='text-highlight-functionality'>camp</span> here. ";
			
			if (isScouted && workshopComponent) {
				var workshopName = TextConstants.getWorkshopName(workshopComponent.resource);
                var workshopControl = sectorControlComponent.hasControlOfLocale(LocaleConstants.LOCALE_ID_WORKSHOP);
                var workshopStatus = workshopControl ? "cleared for use" : "not cleared";
				description += "There is a " + workshopName + " here (" + workshopStatus + "). ";
			}
			
			return description;
		},
		
		// Found resources, enemies
		getStatusDescription: function (hasVision, isScouted, hasEnemies, featuresComponent, passagesComponent, hasCampHere, hasCampOnLevel) {
			var description = "";
			
			if (hasVision) {
				description += this.getDangerDescription(isScouted, featuresComponent, passagesComponent, hasCampHere);
			}
			
			if (isScouted && hasVision && !hasCampHere && !hasCampOnLevel) {
				if (featuresComponent.canHaveCamp() && !hasEnemies && !passagesComponent.passageUp && !passagesComponent.passageDown)
					description += "This would be a good place for a camp. ";
			}
			
			return description;
		},
        
        getResourcesDescription: function (isScouted, featuresComponent) {
            var description = "";
			if (featuresComponent.resourcesScavengable.getTotal() > 0) {
				var discoveredResources = this.sectorHelper.getLocationDiscoveredResources();
				if (discoveredResources.length > 0) {
					description += "Resources scavenged here: " + featuresComponent.getScaResourcesString(discoveredResources) + ". ";
				}
			}
            if (isScouted) {
                if (description.length > 0) description += "<br />";
				description += "Resources naturally occurring here: " + featuresComponent.getColResourcesString() + ". ";
            }
			return description;
        },
		
		getMovementDescription: function (isScouted, passagesComponent, entity) {
			var description = "";
			var improvements = this.playerLocationNodes.head.entity.get(SectorImprovementsComponent);
			
			// Passages up / down
			var passageUpBuilt = improvements.getCount(improvementNames.passageUpStairs) +
				improvements.getCount(improvementNames.passageUpElevator) +
				improvements.getCount(improvementNames.passageUpHole) > 0;
			var passageDownBuilt = improvements.getCount(improvementNames.passageDownStairs) +
				improvements.getCount(improvementNames.passageDownElevator) +
				improvements.getCount(improvementNames.passageDownHole) > 0;
			if (isScouted && passagesComponent.passageUp) {
				description += "There is a <span class='text-highlight-functionality'>passage up</span> here (" + passagesComponent.passageUp.name.toLowerCase() + ")";
				if (!passageUpBuilt) description += ", but it requires repair";
				description += ". ";
			}
			if (isScouted && passagesComponent.passageDown) {
				description += "There is a <span class='text-highlight-functionality'>passage down</span> here (" + passagesComponent.passageDown.name.toLowerCase() + ")";
				if (!passageDownBuilt) description += ", but it requires repair";
				description += ". ";
			}
			
			// Blockers n/s/w/e
			for (var i in PositionConstants.getLevelDirections()) {
				var direction = PositionConstants.getLevelDirections()[i];
				var blocker = passagesComponent.getBlocker(direction);
				if (blocker) {
                    if (this.movementHelper.isBlocked(entity, direction)) {
                        description += "Passage to the " + PositionConstants.getDirectionName(direction) + " is blocked by a " + blocker.name + ". ";
                    } else {
                        description += "A " + blocker.name.toLowerCase() + " on the " + PositionConstants.getDirectionName(direction) + " has been " + TextConstants.getUnblockedVerb(blocker.type) + ". ";
                    }
                }
			}
			return description;
		},
		
		getDangerDescription: function (isScouted, featuresComponent, passagesComponent, hasCampOnLevel) {
			var enemyDesc = "";
			
			var sectorControlComponent = this.playerLocationNodes.head.entity.get(SectorControlComponent);
			var enemiesComponent = this.playerLocationNodes.head.entity.get(EnemiesComponent);
			var hasEnemies = enemiesComponent.hasEnemies() && sectorControlComponent.maxSectorEnemies > 0;
			
			if (!isScouted) {
				enemyDesc += "You have not scouted this sector yet. ";
			}
			
			if (hasEnemies) {
				var defeatableBlockerN = passagesComponent.isDefeatable(PositionConstants.DIRECTION_NORTH);
				var defeatableBlockerS = passagesComponent.isDefeatable(PositionConstants.DIRECTION_SOUTH);
				var defeatableBlockerW = passagesComponent.isDefeatable(PositionConstants.DIRECTION_WEST);
				var defeatableBlockerE = passagesComponent.isDefeatable(PositionConstants.DIRECTION_EAST);
				if (isScouted) {
					enemyDesc = TextConstants.getEnemyText(enemiesComponent.possibleEnemies, sectorControlComponent, defeatableBlockerN, defeatableBlockerS, defeatableBlockerW, defeatableBlockerE);
				}
			} else if (isScouted) {
				enemyDesc += "There doesn't seem to be anything hostile around. ";
			}
            
            var notCampableDesc = "";
            if (isScouted) {
                if (!featuresComponent.campable) {
                    var inhabited = featuresComponent.level > 10;
                    switch (featuresComponent.notCampableReason) {
                        case LevelConstants.UNCAMPABLE_LEVEL_TYPE_RADIATION:
                            if (inhabited && featuresComponent.stateOfRepair > 6) notCampableDesc = "Many entrances have big yellow warning signs on them, with the text 'KEEP OUT' and a radiation sign. ";
                            else if (inhabited && featuresComponent.buildingDensity > 5) notCampableDesc = "Walls are covered in graffiti warning about radiation. ";
                            else notCampableDesc = "There is an eerie air as if the place has been abandoned in a hurry.";
                            break;
                
                        case UNCAMPABLE_LEVEL_TYPE_POLLUTION:
                            if (inhabited && featuresComponent.stateOfRepair > 6) notCampableDesc = "Many entrances have big red warning signs on them with a skull sign and the text 'KEEP OUT'. ";
                            else if (inhabited && featuresComponent.buildingDensity > 5) notCampableDesc = "Walls are covered in graffiti warning about some kind of pollution.";
                            else notCampableDesc = "A noxious smell hangs in the air.";
                            break;
                        
                        case UNCAMPABLE_LEVEL_TYPE_SUPERSTITION:
                            if (inhabited) notCampableDesc = "There aren't any signs of recent human habitation. ";
                            else notCampableDesc = "An unnerving silence blankets the streets. ";
                            break;
                    }
                } else {
                    notCampableDesc = "The level seems safe for habitation.";
                }
            }
			
			return enemyDesc + notCampableDesc;
		},
		
		updateLocales: function () {
			var currentSector = this.playerLocationNodes.head.entity;
			var sectorLocalesComponent = currentSector.get(SectorLocalesComponent);
			var sectorFeaturesComponent = currentSector.get(SectorFeaturesComponent);
			var sectorStatusComponent = currentSector.get(SectorStatusComponent);
			$("#table-out-actions-locales").empty();
			for (var i = 0; i < sectorLocalesComponent.locales.length; i++) {
				var locale = sectorLocalesComponent.locales[i];
				var button = "<button class='action' action='scout_locale_" + locale.getCategory() + "_" + i + "'>" + TextConstants.getLocaleName(locale, sectorFeaturesComponent.stateOfRepair) + "</button>";
				var info = "<span class='p-meta'>" + (sectorStatusComponent.isLocaleScouted(i) ? "Already scouted" : "") + "</span>";
				$("#table-out-actions-locales").append("<tr><td>" + button + "</td><td>" + info + "</td></tr>");
			}
            this.uiFunctions.registerActionButtonListeners("#table-out-actions-locales");
            this.uiFunctions.generateButtonOverlays("#table-out-actions-locales");
            this.uiFunctions.generateCallouts("#table-out-actions-locales");
		},
		
		updateMovementRelatedActions: function () {
			var currentSector = this.playerLocationNodes.head.entity;
			var movementOptionsComponent = currentSector.get(MovementOptionsComponent);
			$("#table-out-actions-movement-related").empty();
			
			function addBlockerActionButton(blocker, direction) {
                if (blocker.type !== MovementConstants.BLOCKER_TYPE_GAP) {
                    if (!movementOptionsComponent.canMoveToDirection(direction)) {
                        var action = blocker.actionBaseID + "_" + direction;
                        var description = blocker.actionDescription;
                        var button = "<button class='action' action='" + action + "'>" + description + "</button>";
                        $("#table-out-actions-movement-related").append("<tr><td>" + button + "</td></tr>");
                    }
                }
			}
			
			for (var i in PositionConstants.getLevelDirections()) {
				var direction = PositionConstants.getLevelDirections()[i];
				var directionBlocker = this.movementHelper.getBlocker(currentSector, direction);
				if (directionBlocker) addBlockerActionButton(directionBlocker, direction);
			}
			
            this.uiFunctions.registerActionButtonListeners("#table-out-actions-movement-related");
            this.uiFunctions.generateButtonOverlays("#table-out-actions-movement-related");
            this.uiFunctions.generateCallouts("#table-out-actions-movement-related");
		},
		
		rebuildVis: function (uiMapHelper) {
            if (!this.playerLocationNodes.head) return;
            if (!uiMapHelper) uiMapHelper = this.uiMapHelper;
            uiMapHelper.rebuildMap("minimap", "minimap-fallback", this.playerLocationNodes.head.position.getPosition(), UIConstants.MAP_MINIMAP_SIZE, true);
		},
    });

    return UIOutLevelSystem;
});
